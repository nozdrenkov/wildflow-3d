// We visualising massive 3D Gaussian Splat models of coral reefs.
// We split the model into smaller cells, say 1x1 meter and show them in a 3D viewer.
// We want to load only the cells that are close to the camera and unload cells that are far away.
// We also want to load cells in batches to avoid memory issues.
// Effectively, we want to implement a LOD system for our 3D viewer.

import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";
import { LRUCache } from "../utils/LRUCache";

const _BASE_PATH = "https://storage.googleapis.com/wildflow/HighResTest";
const _INFO_PATH = `${_BASE_PATH}/info.json`;
const _RESOLUTION = "low"; // could be "high"

// Constants
const CONSTANTS = {
  CELL_VISIBILITY_THRESHOLD: 10,
  MAX_LOADED_CELLS: 10,
  CACHE_SIZE: 10,
  SCENE_UPDATE_INTERVAL: 5000,
  CELL_UPDATE_INTERVAL: 50,
  COLORS: {
    BLUE: 0x0000ff,
    ORANGE: 0xffa500,
    GREEN: 0x00ff00,
  },
};

export default function Viewer3D({
  modelId,
  setDownloadProgress,
  setVisualProgress,
}) {
  const viewerRoot = useRef(null);
  const viewer = useRef(null);
  const loadedCells = useRef(new Map());
  const bufferCache = useRef(new LRUCache(CONSTANTS.CACHE_SIZE));
  const lastUpdate = useRef(0);
  const pendingVisualizationUpdate = useRef(null);
  const lastVisualizationUpdate = useRef(0);
  const lastCellUpdate = useRef(0);
  const [isMounted, setIsMounted] = useState(false);

  // Separate loading from visualization
  const loadBuffer = async (filePath) => {
    try {
      const buffer = await viewer.current.downloadSplatSceneToSplatBuffer(
        filePath,
        20,
        undefined,
        false,
        undefined,
        GaussianSplats3D.SceneFormat.KSplat
      );
      return buffer;
    } catch (error) {
      console.error("Error loading buffer:", error);
      return null;
    }
  };

  const calculateProgress = (visibleFilePaths) => {
    if (!visibleFilePaths?.size) return { download: 10, visual: 0 };

    const totalVisible = visibleFilePaths.size;
    const downloadedCount = Array.from(visibleFilePaths).filter((path) =>
      bufferCache.current.has(path)
    ).length;

    const visualizedCount = Array.from(visibleFilePaths).filter((path) => {
      const cell = Array.from(loadedCells.current.values()).find(
        (cell) => cell.filePath === path
      );
      return cell?.loaded;
    }).length;

    // If we're loading anything, minimum download progress is 10%
    const downloadProgress =
      totalVisible > downloadedCount
        ? 10
        : Math.min(100, Math.round((downloadedCount / totalVisible) * 100));

    const visualProgress = Math.min(
      100,
      Math.round((visualizedCount / totalVisible) * 100)
    );

    return { download: downloadProgress, visual: visualProgress };
  };

  const updateCellIndicators = () => {
    if (!viewer.current?.camera) return;

    const camera = viewer.current.camera;
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    // Get visible cells sorted by distance
    const visibleCells = Array.from(loadedCells.current.entries())
      .map(([key, cell]) => ({
        key,
        cell,
        distance: camera.position.distanceTo(cell.center),
        inFrustum: frustum.containsPoint(cell.center),
      }))
      .filter(
        ({ distance, inFrustum }) =>
          distance <= CONSTANTS.CELL_VISIBILITY_THRESHOLD && inFrustum
      )
      .sort((a, b) => a.distance - b.distance)
      .slice(0, CONSTANTS.MAX_LOADED_CELLS);

    const visibleFilePaths = new Set(
      visibleCells.map(({ cell }) => cell.filePath)
    );

    // Update both progress indicators
    const progress = calculateProgress(visibleFilePaths);
    setDownloadProgress(progress.download);
    setVisualProgress(progress.visual);

    // Update sphere colors immediately
    for (const [key, cell] of loadedCells.current) {
      const isVisible = visibleFilePaths.has(cell.filePath);
      if (cell.loaded) {
        cell.sphere.visible = false;
      } else if (cell.loading) {
        cell.sphere.material.color.setHex(CONSTANTS.COLORS.ORANGE);
        cell.sphere.visible = true;
      } else {
        cell.sphere.material.color.setHex(
          isVisible ? CONSTANTS.COLORS.GREEN : CONSTANTS.COLORS.BLUE
        );
        cell.sphere.visible = true;
      }
    }

    // Check if we should do a full update
    const currentTime = Date.now();
    if (
      currentTime - lastVisualizationUpdate.current >=
      CONSTANTS.SCENE_UPDATE_INTERVAL
    ) {
      lastVisualizationUpdate.current = currentTime;
      updateVisibleCells(visibleFilePaths);
    }
  };

  const updateVisibleCells = async (visibleFilePaths) => {
    // Load necessary buffers into cache
    const loadPromises = Array.from(visibleFilePaths)
      .filter((filePath) => !bufferCache.current.has(filePath))
      .map(async (filePath) => {
        const cell = Array.from(loadedCells.current.values()).find(
          (cell) => cell.filePath === filePath
        );
        if (!cell) return null;

        cell.loading = true;
        cell.sphere.material.color.setHex(CONSTANTS.COLORS.ORANGE);
        const buffer = await loadBuffer(filePath);
        if (buffer) {
          bufferCache.current.set(filePath, buffer);
        }
        cell.loading = false;
        // Return to green if still needed
        if (visibleFilePaths.has(filePath)) {
          cell.sphere.material.color.setHex(CONSTANTS.COLORS.GREEN);
        }
        return buffer;
      });

    await Promise.all(loadPromises);

    // Schedule visualization update
    scheduleVisualizationUpdate(visibleFilePaths);
  };

  const scheduleVisualizationUpdate = (visibleFilePaths) => {
    if (pendingVisualizationUpdate.current) {
      clearTimeout(pendingVisualizationUpdate.current);
    }

    pendingVisualizationUpdate.current = setTimeout(async () => {
      if (!viewer.current || viewer.current.isLoadingOrUnloading()) return;

      try {
        // Clear existing scenes
        const sceneCount = viewer.current.getSceneCount();
        if (sceneCount > 0) {
          if (viewer.current.splatMesh) {
            viewer.current.splatMesh.disposeSplatTree();
          }
          const scenesToRemove = Array.from(
            { length: sceneCount },
            (_, i) => i
          );
          await viewer.current.removeSplatScenes(scenesToRemove, false);
        }

        // Get buffers for visible cells
        const visibleBuffers = Array.from(visibleFilePaths)
          .map((path) => bufferCache.current.get(path))
          .filter(Boolean);

        if (visibleBuffers.length > 0) {
          // Add all visible buffers in one batch
          await viewer.current.addSplatBuffers(
            visibleBuffers,
            visibleBuffers.map(() => ({
              position: [0, 0, 0],
              rotation: [0, 0, 0, 1],
              scale: [1, 1, 1],
              splatAlphaRemovalThreshold: 20,
            })),
            false, // finalBuild
            false, // showLoadingUI
            false, // showLoadingUIForSplatTreeBuild
            false, // replaceExisting
            false, // enableRenderBeforeFirstSort
            true // preserveVisibleRegion
          );
        }

        // Update cell states and hide spheres for visualized cells
        for (const [_, cell] of loadedCells.current) {
          const isVisible = visibleFilePaths.has(cell.filePath);
          cell.loaded = isVisible;
          if (isVisible) {
            cell.sphere.visible = false;
          }
        }
      } catch (error) {
        console.error("Error updating visualization:", error);
      }
    }, 100);
  };

  // Setup and Cleanup
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !viewerRoot.current) return;

    const scene = new THREE.Scene();
    viewer.current = new GaussianSplats3D.Viewer({
      cameraUp: [0, 1, 0],
      initialCameraPosition: [0, 0, 5],
      initialCameraLookAt: [0, 0, 0],
      rootElement: viewerRoot.current,
      selfDrivenMode: true,
      sharedMemoryForWorkers: false,
      dynamicScene: true,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      useBuiltInControls: true,
      threeScene: scene,
      useWorkers: true,
      cleanupOnDestroy: true,
      progressCallback: undefined,
      format: GaussianSplats3D.SceneFormat.KSplat,
    });

    // Initialize cells
    const initializeCells = async () => {
      try {
        const response = await fetch(_INFO_PATH);
        console.log("info json has been fetched from", _INFO_PATH);
        const modelData = await response.json();

        for (const chunk of modelData.chunks) {
          if (chunk.resolution !== _RESOLUTION) continue;

          const gridStep = chunk.gridSize;
          const averageZ = -4; //chunk.averageZ;

          for (const [cellX, cellY] of chunk.tiles) {
            const sphereGeometry = new THREE.SphereGeometry(
              gridStep / 6,
              32,
              32
            );
            const sphereMaterial = new THREE.MeshBasicMaterial({
              color: CONSTANTS.COLORS.BLUE,
            });
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

            const cellCenter = new THREE.Vector3(
              cellX + gridStep / 2,
              cellY + gridStep / 2,
              averageZ
            );
            sphere.position.copy(cellCenter);

            loadedCells.current.set(`${cellX},${cellY}`, {
              sphere,
              center: cellCenter,
              loaded: false,
              loading: false,
              filePath: `${_BASE_PATH}/${chunk.namePrefix}s${gridStep}_x${cellX}_y${cellY}_${chunk.nameSuffix}`,
              lastUsed: Date.now(),
            });

            scene.add(sphere);
          }
        }

        viewer.current.start();
      } catch (error) {
        console.error("Error initializing cells:", error);
      }
    };

    initializeCells();

    const animate = () => {
      requestAnimationFrame(animate);
      const currentTime = Date.now();

      // Update cell indicators frequently
      if (
        currentTime - lastCellUpdate.current >=
        CONSTANTS.CELL_UPDATE_INTERVAL
      ) {
        lastCellUpdate.current = currentTime;
        updateCellIndicators();
      }
    };

    const animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      if (pendingVisualizationUpdate.current) {
        clearTimeout(pendingVisualizationUpdate.current);
      }
      if (viewer.current) {
        viewer.current.dispose();
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
      bufferCache.current.clear();
      loadedCells.current.clear();
    };
  }, [isMounted, modelId]);

  if (!isMounted) return null;

  return <div ref={viewerRoot} style={{ width: "100%", height: "100vh" }} />;
}

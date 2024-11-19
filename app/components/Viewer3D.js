// We visualising massive 3D Gaussian Splat models of coral reefs.
// We split the model into smaller cells, say 1x1 meter and show them in a 3D viewer.
// We want to load only the cells that are close to the camera and unload cells that are far away.
// We also want to load cells in batches to avoid memory issues.
// Effectively, we want to implement a LOD system for our 3D viewer.

import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";

// Constants
const CONSTANTS = {
  CELL_VISIBILITY_THRESHOLD: 10,
  MAX_LOADED_CELLS: 15,
  SCENE_UPDATE_INTERVAL: 1000,
  COLORS: {
    BLUE: 0x0000ff,
    ORANGE: 0xffa500,
    GREEN: 0x00ff00,
  },
  SPLAT_BUFFERS_CACHE: new Map(), // Cache for loaded splat buffers
};

export default function Viewer3D({ modelId, onProgress }) {
  const viewerRoot = useRef(null);
  const viewer = useRef(null);
  const loadedCells = useRef(new Map());
  const lastUpdate = useRef(0);
  const [isMounted, setIsMounted] = useState(false);

  // Load all cells at once
  const loadCells = async (cellsToLoad) => {
    if (viewer.current.isLoadingOrUnloading()) return;

    try {
      // First unload everything
      const sceneCount = viewer.current.getSceneCount();
      if (sceneCount > 0) {
        if (viewer.current.splatMesh) {
          viewer.current.splatMesh.disposeSplatTree();
        }
        const scenesToRemove = Array.from({ length: sceneCount }, (_, i) => i);
        await viewer.current.removeSplatScenes(scenesToRemove, false);
      }

      // Mark cells we're about to load
      for (const { cell } of cellsToLoad) {
        cell.loading = true;
        cell.sphere.material.color.setHex(CONSTANTS.COLORS.ORANGE);
      }

      // First, load all files into memory
      const loadPromises = cellsToLoad.map(async ({ cell }) => {
        if (!CONSTANTS.SPLAT_BUFFERS_CACHE.has(cell.filePath)) {
          const buffer = await viewer.current.downloadSplatSceneToSplatBuffer(
            cell.filePath,
            20, // splatAlphaRemovalThreshold
            undefined, // onProgress
            false, // progressiveBuild
            undefined, // onSectionBuilt
            GaussianSplats3D.SceneFormat.KSplat
          );
          CONSTANTS.SPLAT_BUFFERS_CACHE.set(cell.filePath, buffer);
        }
        return {
          cell,
          buffer: CONSTANTS.SPLAT_BUFFERS_CACHE.get(cell.filePath),
        };
      });

      const loadedBuffers = await Promise.all(loadPromises);

      // Then add all buffers to the scene at once
      const splatBuffers = loadedBuffers.map(({ buffer }) => buffer);
      const splatBufferOptions = loadedBuffers.map(({ cell }) => ({
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
        splatAlphaRemovalThreshold: 20,
      }));

      await viewer.current.addSplatBuffers(
        splatBuffers,
        splatBufferOptions,
        true, // finalBuild
        false, // showLoadingUI
        true, // showLoadingUIForSplatTreeBuild
        true, // replaceExisting
        true // enableRenderBeforeFirstSort
      );

      // Update cell states
      for (const { cell } of cellsToLoad) {
        cell.loaded = true;
        cell.loading = false;
        cell.sphere.visible = false;
      }
    } catch (error) {
      console.error("Error loading cells:", error);
      // Reset states on error
      for (const { cell } of cellsToLoad) {
        cell.loading = false;
        cell.loaded = false;
        cell.sphere.material.color.setHex(CONSTANTS.COLORS.BLUE);
        cell.sphere.visible = true;
      }
    }
  };

  const unloadCell = async (cellKey) => {
    const cellData = loadedCells.current.get(cellKey);
    if (!cellData || !cellData.loaded) return;

    try {
      if (viewer.current.isLoadingOrUnloading()) return;

      // Force cleanup of all scenes
      const sceneCount = viewer.current.getSceneCount();
      if (sceneCount > 0) {
        // Force cleanup before removal
        if (viewer.current.splatMesh) {
          viewer.current.splatMesh.disposeSplatTree();
        }
        const scenesToRemove = Array.from({ length: sceneCount }, (_, i) => i);
        await viewer.current.removeSplatScenes(scenesToRemove, false);
      }

      // Reset all cells to unloaded state
      for (const [_, cell] of loadedCells.current) {
        cell.loaded = false;
        cell.loading = false;
        cell.sphere.material.color.setHex(CONSTANTS.COLORS.BLUE);
        cell.sphere.visible = true;
      }
    } catch (error) {
      console.error(`Error unloading cell ${cellKey}:`, error);
    }
  };

  const updateCellVisibility = () => {
    if (!viewer.current?.camera) return;

    const camera = viewer.current.camera;
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();

    // Calculate the frustum
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    // Get all cells sorted by distance
    const cellDistances = Array.from(loadedCells.current.entries())
      .map(([key, cell]) => ({
        key,
        cell,
        distance: camera.position.distanceTo(cell.center),
        inFrustum: frustum.containsPoint(cell.center),
      }))
      .sort((a, b) => a.distance - b.distance);

    // Get closest cells within threshold
    const closestCells = cellDistances
      .filter(
        ({ distance, inFrustum }) =>
          distance <= CONSTANTS.CELL_VISIBILITY_THRESHOLD && inFrustum
      )
      .slice(0, CONSTANTS.MAX_LOADED_CELLS);

    const closestCellKeys = new Set(closestCells.map((c) => c.key));

    const currentTime = Date.now();
    if (currentTime - lastUpdate.current >= CONSTANTS.SCENE_UPDATE_INTERVAL) {
      lastUpdate.current = currentTime;

      // First, unload cells that are too far away or out of frustum
      const cellsToUnload = Array.from(loadedCells.current.entries())
        .filter(([key, cell]) => {
          if (!cell.loaded) return false;
          const cellData = cellDistances.find((c) => c.key === key);
          return (
            !closestCellKeys.has(key) ||
            cellData.distance > CONSTANTS.CELL_VISIBILITY_THRESHOLD ||
            !cellData.inFrustum
          );
        })
        .map(([key]) => key);

      if (cellsToUnload.length > 0) {
        for (const key of cellsToUnload) {
          unloadCell(key);
        }
      }

      // Then, load new cells if needed
      const cellsToLoad = closestCells.filter(
        ({ cell }) => !cell.loaded && !cell.loading
      );
      if (cellsToLoad.length > 0) {
        loadCells(cellsToLoad);
      }
    }

    // Update sphere visibility and colors
    for (const [key, cell] of loadedCells.current) {
      const cellData = cellDistances.find((c) => c.key === key);
      const isClosest = closestCellKeys.has(key);

      if (cell.loaded) {
        cell.sphere.visible = !isClosest;
      } else {
        cell.sphere.visible = true;
        if (isClosest && !cell.loading) {
          cell.sphere.material.color.setHex(CONSTANTS.COLORS.ORANGE);
        } else {
          cell.sphere.material.color.setHex(
            cellData.inFrustum ? CONSTANTS.COLORS.GREEN : CONSTANTS.COLORS.BLUE
          );
        }
      }
    }
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
      progressCallback: onProgress,
      format: GaussianSplats3D.SceneFormat.KSplat,
    });

    // Initialize cells
    const initializeCells = async () => {
      try {
        const response = await fetch(`/${modelId}.json`);
        const modelData = await response.json();

        for (const patch of modelData.patches) {
          const baseFileName = patch.patch.replace(".ply", "");
          const gridStep = patch.grid_step;
          const averageZ = patch.average_z;

          for (const [cellX, cellY] of patch.cells) {
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
              filePath: `grid-${gridStep}-ksplat/${baseFileName}_${gridStep}s_${cellX}x_${cellY}y.ksplat`,
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
      updateCellVisibility();
    };

    const animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      if (viewer.current) {
        viewer.current.dispose();
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
      CONSTANTS.SPLAT_BUFFERS_CACHE.clear();
      loadedCells.current.clear();
    };
  }, [isMounted, modelId, onProgress]);

  if (!isMounted) return null;

  return <div ref={viewerRoot} style={{ width: "100%", height: "100vh" }} />;
}

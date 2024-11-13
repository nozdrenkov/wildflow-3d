import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";

// Constants
const CONSTANTS = {
  CELL_VISIBILITY_THRESHOLD: 30, // Distance in meters when cells switch between spheres and splats
  MAX_LOADED_CELLS: 20, // Maximum number of simultaneously loaded cell splats
  SCENE_UPDATE_INTERVAL: 333, // Minimum time between scene updates (ms)
  COLORS: {
    BLUE: 0x0000ff, // Distant/unloaded cells
    ORANGE: 0xffa500, // Loading cells
  },
};

// Types (for documentation)
/**
 * @typedef {Object} CellData
 * @property {THREE.Mesh} sphere - Visual representation when splats aren't loaded
 * @property {THREE.Vector3} center - Cell's center position
 * @property {boolean} loaded - Whether splats are currently loaded
 * @property {boolean} loading - Whether splats are currently loading
 * @property {string} filePath - Path to the cell's splat file
 * @property {number} lastUsed - Timestamp of last usage
 */

export default function Viewer3D({ modelId, onProgress }) {
  // Refs
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const loadedCells = useRef(new Map());
  const pendingLoads = useRef(new Set());
  const lastSceneUpdate = useRef(0);
  const [isMounted, setIsMounted] = useState(false);

  // Cell Management Functions
  const unloadCell = async (cellKey) => {
    const cellData = loadedCells.current.get(cellKey);
    if (!cellData || !cellData.loaded) return;

    try {
      if (viewerInstanceRef.current.isLoadingOrUnloading()) return;

      // Force cleanup and remove all scenes
      if (viewerInstanceRef.current.splatMesh) {
        viewerInstanceRef.current.splatMesh.disposeSplatTree();
      }
      const sceneCount = viewerInstanceRef.current.getSceneCount();
      if (sceneCount > 0) {
        const scenesToRemove = Array.from({ length: sceneCount }, (_, i) => i);
        await viewerInstanceRef.current.removeSplatScenes(
          scenesToRemove,
          false
        );
      }

      cellData.loaded = false;
      cellData.loading = false;
      updateCellVisualState(cellData, "distant");
    } catch (error) {
      console.error(`Error unloading cell ${cellKey}:`, error);
    }
  };

  // Visual State Management
  const updateCellVisualState = (cellData, state) => {
    switch (state) {
      case "distant":
        cellData.sphere.material.color.setHex(CONSTANTS.COLORS.BLUE);
        cellData.sphere.visible = true;
        break;
      case "loading":
        cellData.sphere.material.color.setHex(CONSTANTS.COLORS.ORANGE);
        cellData.sphere.visible = true;
        break;
      case "loaded":
        cellData.sphere.visible = false;
        break;
    }
  };

  // Scene Loading Queue Management
  const processLoadQueue = async () => {
    if (pendingLoads.current.size === 0) return;
    if (viewerInstanceRef.current.isLoadingOrUnloading()) return;

    const [nextCellKey] = pendingLoads.current;
    const cellData = loadedCells.current.get(nextCellKey);
    pendingLoads.current.delete(nextCellKey);

    if (!cellData || cellData.loaded || cellData.loading) return;

    try {
      cellData.loading = true;
      updateCellVisualState(cellData, "loading");

      await viewerInstanceRef.current.addSplatScene(cellData.filePath, {
        splatAlphaRemovalThreshold: 20,
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
        showLoadingUI: false,
      });

      cellData.loaded = true;
      cellData.loading = false;
      cellData.lastUsed = Date.now();
      updateCellVisualState(cellData, "loaded");
    } catch (error) {
      console.error(`Error loading cell ${nextCellKey}:`, error);
      cellData.loading = false;
      updateCellVisualState(cellData, "distant");
    }
  };

  // Distance and Priority Calculations
  const updateCellVisibility = () => {
    if (!viewerInstanceRef.current?.camera) return;

    const camera = viewerInstanceRef.current.camera;
    const currentTime = Date.now();

    // Calculate and sort cells by distance
    const cellDistances = Array.from(loadedCells.current.entries())
      .map(([key, cell]) => ({
        key,
        cell,
        distance: camera.position.distanceTo(cell.center),
      }))
      .sort((a, b) => a.distance - b.distance);

    // Determine closest cells within threshold
    const closeCells = cellDistances.filter(
      ({ distance }) => distance <= CONSTANTS.CELL_VISIBILITY_THRESHOLD
    );
    const closestCells = closeCells.slice(0, CONSTANTS.MAX_LOADED_CELLS);
    const closestCellKeys = new Set(closestCells.map((c) => c.key));

    // Update all cells' visual states
    for (const [_, cell] of loadedCells.current) {
      updateCellVisualState(cell, "distant");
    }

    // Process scene updates if enough time has passed
    if (
      currentTime - lastSceneUpdate.current >=
      CONSTANTS.SCENE_UPDATE_INTERVAL
    ) {
      lastSceneUpdate.current = currentTime;

      // Unload cells that are no longer needed
      for (const [key, cell] of loadedCells.current) {
        if (cell.loaded && !closestCellKeys.has(key)) {
          unloadCell(key);
        }
      }

      // Queue new loads for closest cells
      pendingLoads.current.clear();
      for (const { key, cell } of closestCells) {
        if (!cell.loaded && !cell.loading) {
          pendingLoads.current.add(key);
        }
      }

      processLoadQueue();
    }

    // Update visual states for closest cells
    for (const { cell } of closestCells) {
      if (cell.loaded) {
        updateCellVisualState(cell, "loaded");
      } else if (cell.loading || pendingLoads.current.has(cell.key)) {
        updateCellVisualState(cell, "loading");
      }
    }
  };

  // Setup and Cleanup
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !viewerRef.current) return;

    const scene = new THREE.Scene();
    const viewer = new GaussianSplats3D.Viewer({
      cameraUp: [0, 1, 0],
      initialCameraPosition: [0, 0, 5],
      initialCameraLookAt: [0, 0, 0],
      rootElement: viewerRef.current,
      selfDrivenMode: true,
      sharedMemoryForWorkers: false,
      dynamicScene: true,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      threeScene: scene,
      useWorkers: true,
      cleanupOnDestroy: true,
      progressCallback: onProgress,
    });

    viewerInstanceRef.current = viewer;

    // Initialize cells from model data
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
              filePath: `grid-${gridStep}/${baseFileName}_${gridStep}s_${cellX}x_${cellY}y.ply`,
              lastUsed: Date.now(),
            });

            scene.add(sphere);
          }
        }

        viewer.start();
      } catch (error) {
        console.error("Error initializing cells:", error);
      }
    };

    initializeCells();

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      updateCellVisibility();
    };

    const animationId = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.dispose();
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
      loadedCells.current.clear();
      pendingLoads.current.clear();
    };
  }, [isMounted, modelId, onProgress]);

  if (!isMounted) return null;

  return <div ref={viewerRef} style={{ width: "100%", height: "100vh" }} />;
}

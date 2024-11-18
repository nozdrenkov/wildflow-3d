import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";

// Constants
const CONSTANTS = {
  CELL_VISIBILITY_THRESHOLD: 10,
  MAX_LOADED_CELLS: 15,
  SCENE_UPDATE_INTERVAL: 333,
  COLORS: {
    BLUE: 0x0000ff,
    ORANGE: 0xffa500,
  },
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

    // First unload everything
    const sceneCount = viewer.current.getSceneCount();
    if (sceneCount > 0) {
      if (viewer.current.splatMesh) {
        viewer.current.splatMesh.disposeSplatTree();
      }
      const scenesToRemove = Array.from({ length: sceneCount }, (_, i) => i);
      await viewer.current.removeSplatScenes(scenesToRemove, false);

      // Reset all cells to unloaded state
      for (const [_, cell] of loadedCells.current) {
        cell.loaded = false;
        cell.loading = false;
        cell.sphere.material.color.setHex(CONSTANTS.COLORS.BLUE);
        cell.sphere.visible = true;
      }
    }

    // Mark cells we're about to load
    for (const { cell } of cellsToLoad) {
      cell.loading = true;
      cell.sphere.material.color.setHex(CONSTANTS.COLORS.ORANGE);
    }

    try {
      // Load all new cells at once
      for (const { cell } of cellsToLoad) {
        // what's happening here, we download the splat file and then add it to the scene
        // can we separate these two operations?
        await viewer.current.addSplatScene(cell.filePath, {
          splatAlphaRemovalThreshold: 20,
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
          showLoadingUI: false,
        });
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

    // Get all cells sorted by distance
    const cellDistances = Array.from(loadedCells.current.entries())
      .map(([key, cell]) => ({
        key,
        cell,
        distance: camera.position.distanceTo(cell.center),
      }))
      .sort((a, b) => a.distance - b.distance);

    // Get closest cells within threshold
    const closestCells = cellDistances
      .filter(({ distance }) => distance <= CONSTANTS.CELL_VISIBILITY_THRESHOLD)
      .slice(0, CONSTANTS.MAX_LOADED_CELLS);

    const closestCellKeys = new Set(closestCells.map((c) => c.key));

    const currentTime = Date.now();
    if (currentTime - lastUpdate.current >= CONSTANTS.SCENE_UPDATE_INTERVAL) {
      lastUpdate.current = currentTime;

      // First, unload cells that are no longer needed
      for (const [key, cell] of loadedCells.current) {
        if (cell.loaded && !closestCellKeys.has(key)) {
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

    // Update sphere visibility every frame
    for (const [key, cell] of loadedCells.current) {
      const isClosest = closestCellKeys.has(key);
      if (cell.loaded) {
        cell.sphere.visible = !isClosest;
      } else {
        cell.sphere.visible = true;
        if (isClosest && !cell.loading) {
          cell.sphere.material.color.setHex(CONSTANTS.COLORS.ORANGE);
        } else {
          cell.sphere.material.color.setHex(CONSTANTS.COLORS.BLUE);
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
      threeScene: scene,
      useWorkers: true,
      cleanupOnDestroy: true,
      progressCallback: onProgress,
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
      loadedCells.current.clear();
    };
  }, [isMounted, modelId, onProgress]);

  if (!isMounted) return null;

  return <div ref={viewerRoot} style={{ width: "100%", height: "100vh" }} />;
}

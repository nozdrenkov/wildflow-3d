import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";

const CELL_VISIBILITY_THRESHOLD = 10; // Distance in meters when cells switch between spheres and splats
const MAX_LOADED_CELLS = 3; // Maximum number of simultaneously loaded cell splats
const CELL_UNLOAD_CHECK_INTERVAL = 1000; // How often to check for cells to unload (ms)
const TEST_CELL = { x: 0, y: -3 };
const DISABLE_AUTO_VISIBILITY = true;

export default function Viewer3D({ modelId, onProgress }) {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const loadedCells = useRef(new Map());
  const cellLoadQueue = useRef(new Set());
  const lastUnloadCheck = useRef(0);
  const [testCellEnabled, setTestCellEnabled] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !viewerRef.current) return;

    const currentViewerRef = viewerRef.current;
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
      progressCallback: (percent, message) => {
        onProgress(percent, message);
      },
    });

    viewerInstanceRef.current = viewer;

    const loadScenes = async () => {
      try {
        const response = await fetch(`/${modelId}.json`);
        const modelData = await response.json();

        for (const patch of modelData.patches) {
          const baseFileName = patch.patch.replace(".ply", "");
          const gridStep = patch.grid_step;
          const averageZ = patch.average_z;

          // Create spheres for all cells initially
          for (const [cellX, cellY] of patch.cells) {
            const sphereGeometry = new THREE.SphereGeometry(
              gridStep / 6,
              32,
              32
            );
            const sphereMaterial = new THREE.MeshBasicMaterial({
              color: 0x0000ff,
            });
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

            const cellCenter = new THREE.Vector3(
              cellX + gridStep / 2,
              cellY + gridStep / 2,
              averageZ
            );
            sphere.position.copy(cellCenter);

            // Store cell information
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

        if (viewerInstanceRef.current) {
          viewerInstanceRef.current.start();
        }
      } catch (error) {
        console.error("Error loading scene files:", error);
      }
    };

    loadScenes();

    return () => {
      const viewer = viewerInstanceRef.current;
      if (viewer) {
        if (viewer.renderLoop) {
          viewer.renderLoop.stop();
        }
        if (viewer.splatMesh) {
          viewer.splatMesh.disposeSplatTree();
          viewer.splatMesh.scene.remove(viewer.splatMesh);
        }
        if (viewer.renderer) {
          viewer.renderer.dispose();
        }
        if (currentViewerRef && currentViewerRef.firstChild) {
          currentViewerRef.removeChild(currentViewerRef.firstChild);
        }
        viewerInstanceRef.current = null;
      }

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });

      loadedCells.current.clear();
      cellLoadQueue.current.clear();
    };
  }, [isMounted, modelId, onProgress]);

  const processLoadQueue = async () => {
    if (cellLoadQueue.current.size === 0) return;

    const loadedCount = Array.from(loadedCells.current.values()).filter(
      (cell) => cell.loaded
    ).length;

    if (loadedCount >= MAX_LOADED_CELLS) return;

    const [nextCellKey] = cellLoadQueue.current;
    const cellData = loadedCells.current.get(nextCellKey);
    cellLoadQueue.current.delete(nextCellKey);

    if (!cellData || cellData.loaded || cellData.loading) return;

    try {
      // Check if viewer is currently loading or unloading
      if (viewerInstanceRef.current.isLoadingOrUnloading()) {
        // Put the cell back in the queue for later processing
        cellLoadQueue.current.add(nextCellKey);
        return;
      }

      cellData.loading = true;
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
    } catch (error) {
      console.error(`Error loading cell ${nextCellKey}:`, error);
      cellData.loading = false;
      // Put the cell back in the queue if it was a loading conflict
      if (error.message.includes("Cannot add splat scene while another")) {
        cellLoadQueue.current.add(nextCellKey);
      }
    }
  };

  const unloadCell = async (cellKey) => {
    const cellData = loadedCells.current.get(cellKey);
    if (!cellData || !cellData.loaded) return;

    try {
      if (viewerInstanceRef.current.isLoadingOrUnloading()) {
        return;
      }

      const sceneCount = viewerInstanceRef.current.getSceneCount();
      const scenesToRemove = [];

      // Find all scenes that match our cell
      for (let i = 0; i < sceneCount; i++) {
        const scene = viewerInstanceRef.current.getSplatScene(i);
        if (scene && scene.url === cellData.filePath) {
          scenesToRemove.push(i);
        }
      }

      if (scenesToRemove.length > 0) {
        // Force cleanup before removal
        if (viewerInstanceRef.current.splatMesh) {
          viewerInstanceRef.current.splatMesh.disposeSplatTree();
        }

        // Remove scenes in reverse order to maintain correct indices
        for (let i = scenesToRemove.length - 1; i >= 0; i--) {
          await viewerInstanceRef.current.removeSplatScenes(
            [scenesToRemove[i]],
            false
          );
        }

        // Force a new sort to update visibility
        await viewerInstanceRef.current.runSplatSort(true, true);

        cellData.loaded = false;
        cellData.sphere.visible = true;
      }
    } catch (error) {
      console.error(`Error unloading cell ${cellKey}:`, error);
    }
  };

  const checkCellsToUnload = () => {
    const loadedCellsArray = Array.from(loadedCells.current.values())
      .filter((cell) => cell.loaded)
      .sort((a, b) => a.lastUsed - b.lastUsed);

    while (loadedCellsArray.length > MAX_LOADED_CELLS) {
      const oldestCell = loadedCellsArray.shift();
      if (oldestCell) {
        const cellKey = Array.from(loadedCells.current.entries()).find(
          ([_, cell]) => cell === oldestCell
        )?.[0];
        if (cellKey) {
          unloadCell(cellKey);
        }
      }
    }
  };

  const updateCellVisibility = () => {
    if (!viewerInstanceRef.current || !viewerInstanceRef.current.camera) return;

    const camera = viewerInstanceRef.current.camera;
    const currentTime = Date.now();

    // First, update all sphere visibilities based on distance
    for (const [cellKey, cellData] of loadedCells.current) {
      // Skip the test cell
      if (cellKey === `${TEST_CELL.x},${TEST_CELL.y}`) continue;

      const distance = camera.position.distanceTo(cellData.center);

      if (distance > CELL_VISIBILITY_THRESHOLD) {
        cellData.sphere.visible = true;
        if (cellData.loaded) {
          unloadCell(cellKey);
        }
      } else {
        cellData.sphere.visible = false;
        if (!cellData.loaded && !cellData.loading) {
          cellLoadQueue.current.add(cellKey);
        }
      }
    }

    if (currentTime - lastUnloadCheck.current > CELL_UNLOAD_CHECK_INTERVAL) {
      checkCellsToUnload();
      lastUnloadCheck.current = currentTime;
    }

    processLoadQueue();
  };

  const toggleTestCell = async () => {
    const cellKey = `${TEST_CELL.x},${TEST_CELL.y}`;
    const cellData = loadedCells.current.get(cellKey);

    if (!cellData) return;

    try {
      if (testCellEnabled) {
        // Turn off - force remove all scenes
        const sceneCount = viewerInstanceRef.current.getSceneCount();
        if (sceneCount > 0) {
          const scenesToRemove = Array.from(
            { length: sceneCount },
            (_, i) => i
          );
          await viewerInstanceRef.current.removeSplatScenes(
            scenesToRemove,
            false
          );
        }
        cellData.loaded = false;
        cellData.loading = false;
        cellData.sphere.material.color.setHex(0x0000ff); // Blue
        cellData.sphere.visible = true;
      } else {
        // Turn on
        cellData.sphere.material.color.setHex(0xffa500); // Orange
        cellData.sphere.visible = true;
        cellData.loading = true;

        // Make sure no other scenes are loaded
        const sceneCount = viewerInstanceRef.current.getSceneCount();
        if (sceneCount > 0) {
          const scenesToRemove = Array.from(
            { length: sceneCount },
            (_, i) => i
          );
          await viewerInstanceRef.current.removeSplatScenes(
            scenesToRemove,
            false
          );
        }

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
        cellData.sphere.visible = false;
      }

      setTestCellEnabled(!testCellEnabled);
    } catch (error) {
      console.error("Error toggling test cell:", error);
      cellData.loading = false;
      cellData.sphere.material.color.setHex(0x0000ff); // Reset to blue if error
    }
  };

  useEffect(() => {
    const animate = () => {
      requestAnimationFrame(animate);
      updateCellVisibility();
    };

    const animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  if (!isMounted) return null;

  return (
    <>
      <button
        onClick={toggleTestCell}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          zIndex: 1000,
          padding: "10px",
          backgroundColor: testCellEnabled ? "red" : "green",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        Test Cell {testCellEnabled ? "OFF" : "ON"}
      </button>
      <div ref={viewerRef} style={{ width: "100%", height: "100vh" }} />
    </>
  );
}

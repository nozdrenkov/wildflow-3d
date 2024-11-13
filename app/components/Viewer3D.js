import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";

const CELL_VISIBILITY_THRESHOLD = 10; // Distance in meters when cells switch between spheres and splats
const MAX_LOADED_CELLS = 3; // Maximum number of simultaneously loaded cell splats
const CELL_UNLOAD_CHECK_INTERVAL = 1000; // How often to check for cells to unload (ms)
const DISABLE_AUTO_VISIBILITY = true;
const POSITION_CHECK_INTERVAL = 333; // Check camera position every 1/3 second

export default function Viewer3D({ modelId, onProgress }) {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const loadedCells = useRef(new Map());
  const cellLoadQueue = useRef(new Set());
  const lastUnloadCheck = useRef(0);
  const lastPositionCheck = useRef(0);
  const pendingLoads = useRef(new Set());

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
    if (pendingLoads.current.size === 0) return;
    if (viewerInstanceRef.current.isLoadingOrUnloading()) return;

    // Take the first pending cell
    const [nextCellKey] = pendingLoads.current;
    const cellData = loadedCells.current.get(nextCellKey);
    pendingLoads.current.delete(nextCellKey);

    if (!cellData || cellData.loaded || cellData.loading) return;

    try {
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
      cellData.sphere.visible = false;
    } catch (error) {
      console.error(`Error loading cell ${nextCellKey}:`, error);
      cellData.loading = false;
      cellData.sphere.material.color.setHex(0x0000ff); // Reset to blue if error
      pendingLoads.current.delete(nextCellKey);
    }
  };

  const unloadCell = async (cellKey) => {
    const cellData = loadedCells.current.get(cellKey);
    if (!cellData || !cellData.loaded) return;

    try {
      if (viewerInstanceRef.current.isLoadingOrUnloading()) return;

      // Force remove all scenes
      const sceneCount = viewerInstanceRef.current.getSceneCount();
      if (sceneCount > 0) {
        // Force cleanup before removal
        if (viewerInstanceRef.current.splatMesh) {
          viewerInstanceRef.current.splatMesh.disposeSplatTree();
        }
        const scenesToRemove = Array.from({ length: sceneCount }, (_, i) => i);
        await viewerInstanceRef.current.removeSplatScenes(
          scenesToRemove,
          false
        );
      }

      cellData.loaded = false;
      cellData.loading = false;
      cellData.sphere.material.color.setHex(0x0000ff); // Blue
      cellData.sphere.visible = true;
    } catch (error) {
      console.error(`Error unloading cell ${cellKey}:`, error);
    }
  };

  const updateCellVisibility = () => {
    if (!viewerInstanceRef.current || !viewerInstanceRef.current.camera) return;

    const currentTime = Date.now();
    if (currentTime - lastPositionCheck.current < POSITION_CHECK_INTERVAL) {
      return;
    }
    lastPositionCheck.current = currentTime;

    const camera = viewerInstanceRef.current.camera;

    // Calculate distances for all cells
    const cellDistances = Array.from(loadedCells.current.entries()).map(
      ([key, cell]) => ({
        key,
        cell,
        distance: camera.position.distanceTo(cell.center),
      })
    );

    // Sort by distance
    cellDistances.sort((a, b) => a.distance - b.distance);

    // Get the closest cells within threshold
    const closeCells = cellDistances.filter(
      ({ distance }) => distance <= CELL_VISIBILITY_THRESHOLD
    );
    const closestCells = closeCells.slice(0, MAX_LOADED_CELLS);
    const closestCellKeys = new Set(closestCells.map((c) => c.key));

    // First, unload any cells that shouldn't be visible
    for (const [key, cell] of loadedCells.current) {
      if (cell.loaded && !closestCellKeys.has(key)) {
        unloadCell(key);
      }
    }

    // Reset pending loads
    pendingLoads.current.clear();

    // Update closest cells
    for (const { key, cell } of closestCells) {
      if (!cell.loaded && !cell.loading) {
        pendingLoads.current.add(key);
        cell.sphere.material.color.setHex(0xffa500); // Orange for pending load
      }
      cell.sphere.visible = !cell.loaded;
    }

    // Process any pending loads
    processLoadQueue();
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

  return <div ref={viewerRef} style={{ width: "100%", height: "100vh" }} />;
}

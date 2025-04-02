import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

// Constants
const _BOX_SIZE = 5;
const _HALF_BOX_SIZE = Math.floor(_BOX_SIZE / 2);
const _DEFAULT_Z_RANGE = {
  minZ: -4.1188249588012695,
  maxZ: -3.3649239540100098,
};
const _POINT_SIZE = 0.03;
const _POINT_TEXTURE_SIZE = 64;
const _DEFAULT_CAMERA = {
  position: [-6.36302, -7.56634, 1.84438],
  lookAt: [-7.69713, -7.04284, -3.20002],
  up: [0.0, 1.0, 0.0],
};
const _MODEL_PATH = "/m9";
const _METADATA_PATH = `${_MODEL_PATH}/metadata.json`;
const _POINT_CLOUD_PATH = `${_MODEL_PATH}/point_cloud.ply`;
const _SPLAT_FOLDER = `${_MODEL_PATH}/1s`;

export default function Viewer3D({ modelId, onProgress }) {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const boundingBoxRef = useRef(null);
  const boundingEdgesRef = useRef(null);
  const loadedSplatIdsRef = useRef(new Set());
  const currentSelectionRef = useRef(null);
  const metadataRef = useRef(null);
  const zRangeRef = useRef({ ..._DEFAULT_Z_RANGE });
  const isLoadingRef = useRef(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !viewerRef.current) return;

    const threeScene = new THREE.Scene();
    let cleanup;

    async function init() {
      // Load metadata
      try {
        const response = await fetch(_METADATA_PATH);
        metadataRef.current = await response.json();
        console.log(
          "Loaded metadata for",
          Object.keys(metadataRef.current).length,
          "cells"
        );
      } catch (error) {
        console.error("Error loading metadata:", error);
      }

      // Create viewer and initialize scene
      const viewer = createViewer(threeScene);
      viewerInstanceRef.current = viewer;

      // Create bounding box
      createBoundingBox(threeScene);

      // Set up event handlers
      setupEventHandlers(viewer);

      // Load point cloud and initial splats
      loadPointCloud(threeScene, viewer);

      // Prepare cleanup function
      cleanup = () => cleanupResources(viewer, threeScene);
    }

    init();

    return () => cleanup && cleanup();
  }, [isMounted, modelId, onProgress]);

  function createViewer(threeScene) {
    const viewer = new GaussianSplats3D.Viewer({
      cameraUp: _DEFAULT_CAMERA.up,
      initialCameraPosition: _DEFAULT_CAMERA.position,
      initialCameraLookAt: _DEFAULT_CAMERA.lookAt,
      rootElement: viewerRef.current,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      crossOrigin: "anonymous",
      threeScene: threeScene,
      selfDrivenMode: true,
      useWorkers: true,
      workerConfig: { crossOriginIsolated: true },
      dynamicScene: true,
      freeIntermediateSplatData: false,
      inMemoryCompressionLevel: 0,
      renderMode: GaussianSplats3D.RenderMode.Always,
      controlsEnabled: true,
      disableControlsDuringLoading: false,
      controlOptions: {
        autoRotate: false,
        enableDamping: true,
        dampingFactor: 0.05,
      },
      progressCallback: (percent, message) => {
        console.log(`Loading progress: ${percent}% - ${message}`);
        onProgress(percent, message);
      },
    });

    viewer.start();

    // Add a force render method to the viewer for immediate visual updates
    viewer.forceRender = function () {
      if (this.renderer && this.camera && this.threeScene) {
        // Update controls before rendering
        if (this.controls) this.controls.update();
        this.renderer.render(this.threeScene, this.camera);
      } else if (this.renderer && this.camera) {
        if (this.controls) this.controls.update();
        this.renderer.render(threeScene, this.camera);
      }
    };

    // Set up an animation loop to keep controls responsive during loading
    const animateControls = () => {
      if (viewer.controls && viewer.renderer && viewer.camera) {
        viewer.controls.update();
        // Only render if we're in loading state to avoid duplicate renders
        if (isLoadingRef.current) {
          viewer.renderer.render(
            viewer.threeScene || threeScene,
            viewer.camera
          );
        }
      }
      viewer._controlsAnimationId = requestAnimationFrame(animateControls);
    };

    // Start the animation loop
    animateControls();

    // Ensure controls are always enabled
    if (viewer.controls) {
      viewer.controls.enabled = true;
    }

    return viewer;
  }

  function createCircleTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = _POINT_TEXTURE_SIZE;
    canvas.height = _POINT_TEXTURE_SIZE;
    const context = canvas.getContext("2d");
    const radius = _POINT_TEXTURE_SIZE / 2 - 2;

    context.beginPath();
    context.arc(
      _POINT_TEXTURE_SIZE / 2,
      _POINT_TEXTURE_SIZE / 2,
      radius,
      0,
      2 * Math.PI
    );
    context.fillStyle = "white";
    context.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function createBoundingBox(threeScene) {
    // Remove previous box if exists
    if (boundingBoxRef.current && boundingBoxRef.current.parent) {
      threeScene.remove(boundingBoxRef.current);
      threeScene.remove(boundingEdgesRef.current);
    }

    const boxDepth = zRangeRef.current.maxZ - zRangeRef.current.minZ;
    const geometry = new THREE.BoxGeometry(_BOX_SIZE, _BOX_SIZE, boxDepth);
    const edges = new THREE.EdgesGeometry(geometry);

    const boxMaterial = new THREE.MeshBasicMaterial({
      color: 0x0000ff, // Initial blue color
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      visible: true,
    });

    const edgesMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      visible: true,
    });

    const boundingBox = new THREE.Mesh(geometry, boxMaterial);
    const boundingEdges = new THREE.LineSegments(edges, edgesMaterial);

    // Set initial position
    const centerZ = (zRangeRef.current.minZ + zRangeRef.current.maxZ) / 2;
    boundingBox.position.set(0, 0, centerZ);
    boundingEdges.position.copy(boundingBox.position);

    // Add to scene
    threeScene.add(boundingBox);
    threeScene.add(boundingEdges);

    // Store references
    boundingBoxRef.current = boundingBox;
    boundingEdgesRef.current = boundingEdges;
  }

  function updateBoundingBox(x, y) {
    if (!boundingBoxRef.current) return;

    const boundingBox = boundingBoxRef.current;
    const boundingEdges = boundingEdgesRef.current;

    // Update position
    boundingBox.position.x = x;
    boundingBox.position.y = y;
    boundingEdges.position.x = x;
    boundingEdges.position.y = y;
  }

  function updateBoundingBoxGeometry(zMin, zMax) {
    if (!boundingBoxRef.current) return;

    const boundingBox = boundingBoxRef.current;
    const boundingEdges = boundingEdgesRef.current;

    const boxDepth = zMax - zMin;
    const centerZ = (zMin + zMax) / 2;

    // Update bounding box geometry
    boundingBox.geometry.dispose();
    boundingBox.geometry = new THREE.BoxGeometry(
      _BOX_SIZE,
      _BOX_SIZE,
      boxDepth
    );
    boundingBox.position.z = centerZ;

    // Update edges
    boundingEdges.geometry.dispose();
    boundingEdges.geometry = new THREE.EdgesGeometry(boundingBox.geometry);
    boundingEdges.position.z = centerZ;
  }

  function computeZRange(startX, startY) {
    const metadata = metadataRef.current;
    if (!metadata) return { ..._DEFAULT_Z_RANGE };

    const cellZValues = [];

    for (let y = 0; y < _BOX_SIZE; y++) {
      for (let x = 0; x < _BOX_SIZE; x++) {
        const cellX = startX + x;
        const cellY = startY + y;
        const cellId = `${cellX}x${cellY}y1s`;

        if (metadata[cellId]) {
          cellZValues.push({
            minZ: metadata[cellId].minZ,
            maxZ: metadata[cellId].maxZ,
          });
        }
      }
    }

    if (cellZValues.length === 0) return { ..._DEFAULT_Z_RANGE };

    return {
      minZ: Math.min(...cellZValues.map((z) => z.minZ)),
      maxZ: Math.max(...cellZValues.map((z) => z.maxZ)),
    };
  }

  function setupEventHandlers(viewer) {
    // Handle mouse move
    viewer.renderer.domElement.addEventListener("mousemove", (event) => {
      // We need to allow navigation even during loading,
      // but only block the bounding box updates
      handleMouseMove(event, viewer);
    });

    // Handle double-click
    viewer.renderer.domElement.addEventListener("dblclick", (event) => {
      // Only handle double-click if not already loading
      if (!isLoadingRef.current) {
        handleDoubleClick(event, viewer);
      }
    });
  }

  function handleMouseMove(event, viewer) {
    // Get mouse position and intersection
    const intersection = getMouseIntersection(event, viewer);
    if (!intersection) return;

    const { point, gridX, gridY } = intersection;

    // Only update and show the bounding box if we're not in loading state
    if (!isLoadingRef.current) {
      // Determine start of 5x5 grid containing this point
      const startX = gridX - _HALF_BOX_SIZE;
      const startY = gridY - _HALF_BOX_SIZE;

      // Calculate box center
      const boxCenterX = startX + _HALF_BOX_SIZE + 0.5;
      const boxCenterY = startY + _HALF_BOX_SIZE + 0.5;

      // Calculate Z range for this grid
      const zRange = computeZRange(startX, startY);
      const hasData =
        zRange.minZ !== _DEFAULT_Z_RANGE.minZ ||
        zRange.maxZ !== _DEFAULT_Z_RANGE.maxZ;

      // Update box geometry if Z range changed
      if (
        hasData &&
        (zRange.minZ !== zRangeRef.current.minZ ||
          zRange.maxZ !== zRangeRef.current.maxZ)
      ) {
        zRangeRef.current = zRange;
        updateBoundingBoxGeometry(zRange.minZ, zRange.maxZ);
      }

      // Update box position
      updateBoundingBox(boxCenterX, boxCenterY);

      // Check if point is within currently loaded area
      let isInLoadedArea = false;
      if (currentSelectionRef.current) {
        const {
          startX: loadedStartX,
          startY: loadedStartY,
          boxSize,
        } = currentSelectionRef.current;
        isInLoadedArea =
          gridX >= loadedStartX &&
          gridX < loadedStartX + boxSize &&
          gridY >= loadedStartY &&
          gridY < loadedStartY + boxSize;
      }

      // Only show the box if we have data and we're outside the loaded area
      if (boundingBoxRef.current) {
        boundingBoxRef.current.visible = hasData && !isInLoadedArea;
        boundingEdgesRef.current.visible = hasData && !isInLoadedArea;
      }
    }
    // We're not returning here, so the event continues to propagate
    // to the camera controls, allowing navigation even during loading
  }

  function handleDoubleClick(event, viewer) {
    console.log("Double-click detected");

    // Show progress immediately
    onProgress(5, "Processing double-click...");

    // Get mouse position and intersection
    const intersection = getMouseIntersection(event, viewer);
    if (!intersection) {
      onProgress(0, "");
      return;
    }

    const { point } = intersection;
    console.log(
      `Double-click intersection at: ${point.x}, ${point.y}, ${point.z}`
    );

    // Set loading state to true to prevent box movement
    isLoadingRef.current = true;

    // Change bounding box color to orange to indicate loading
    if (boundingBoxRef.current) {
      boundingBoxRef.current.material.color.set(0xff8800); // Orange color
      boundingBoxRef.current.visible = true;
      boundingEdgesRef.current.visible = true;
    }

    loadSplatsForGrid(point.x, point.y).catch((error) => {
      console.error("Error in loadSplatsForGrid:", error);
      // Reset color back to blue if there's an error
      if (boundingBoxRef.current) {
        boundingBoxRef.current.material.color.set(0x0000ff); // Blue color
      }
      // Set loading state back to false
      isLoadingRef.current = false;
      onProgress(0, "");
    });
  }

  function getMouseIntersection(event, viewer) {
    if (!viewer || !viewer.camera) return null;

    // Calculate mouse position in normalized device coordinates
    const rect = viewer.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Set up raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, viewer.camera);
    const ray = raycaster.ray;

    // Find intersection with horizontal plane
    const planeZ = (zRangeRef.current.minZ + zRangeRef.current.maxZ) / 2;
    const t = (planeZ - ray.origin.z) / ray.direction.z;

    if (t <= 0) return null; // No intersection

    // Calculate intersection point
    const point = new THREE.Vector3()
      .copy(ray.origin)
      .addScaledVector(ray.direction, t);
    const gridX = Math.floor(point.x);
    const gridY = Math.floor(point.y);

    return { point, gridX, gridY };
  }

  async function loadSplatsForGrid(centerX, centerY) {
    try {
      // Make sure loading state is true
      isLoadingRef.current = true;

      // Ensure controls remain enabled during loading
      const viewer = viewerInstanceRef.current;
      if (viewer && viewer.controls) {
        viewer.controls.enabled = true;
      }

      onProgress(5, "Preparing to load splats...");
      console.log(`Loading splats for grid centered at ${centerX},${centerY}`);

      // Calculate top-left corner of the grid
      const startX = Math.floor(centerX) - _HALF_BOX_SIZE;
      const startY = Math.floor(centerY) - _HALF_BOX_SIZE;

      // Compute Z range for this grid
      const zRange = computeZRange(startX, startY);
      zRangeRef.current = zRange;

      // Update box position for current load area
      const boxCenterX = startX + _HALF_BOX_SIZE + 0.5;
      const boxCenterY = startY + _HALF_BOX_SIZE + 0.5;
      updateBoundingBox(boxCenterX, boxCenterY);
      updateBoundingBoxGeometry(zRange.minZ, zRange.maxZ);

      // Ensure box is orange and visible during the entire loading process
      if (boundingBoxRef.current) {
        boundingBoxRef.current.material.color.set(0xff8800); // Orange color
        boundingBoxRef.current.visible = true;
        boundingEdgesRef.current.visible = true;
      }

      // Force a render to ensure the orange box is visible
      if (viewer && viewer.forceRender) {
        viewer.forceRender();
      }

      // Generate cell IDs for the grid
      const cellsToLoad = [];
      for (let y = 0; y < _BOX_SIZE; y++) {
        for (let x = 0; x < _BOX_SIZE; x++) {
          const cellX = startX + x;
          const cellY = startY + y;
          const cellId = `${cellX}x${cellY}y1s`;
          cellsToLoad.push(cellId);
        }
      }

      // Store current selection
      currentSelectionRef.current = {
        startX,
        startY,
        boxSize: _BOX_SIZE,
        cellIds: cellsToLoad,
      };

      // 1. Clear existing content
      onProgress(10, "Clearing previous splats...");
      await clearExistingSplats(viewer);

      // 2. Download splat files
      onProgress(20, "Downloading splat files...");
      const { splatBuffers, splatConfigs } = await downloadSplatFiles(
        viewer,
        cellsToLoad
      );

      // 3. Add splats to scene
      onProgress(90, "Preparing to display splats...");
      await addSplatsToScene(viewer, splatBuffers, splatConfigs);

      // 4. Update bounding box
      updateBoundingBoxGeometry(zRange.minZ, zRange.maxZ);

      // 5. Show completion
      onProgress(100, "Loading complete");
      setTimeout(() => onProgress(0, ""), 1500);
    } catch (error) {
      console.error("Error loading splats:", error);
      onProgress(100, "Error loading splats");
      setTimeout(() => onProgress(0, ""), 2000);

      // Make sure to reset loading state even if error occurs
      isLoadingRef.current = false;
    }
  }

  async function clearExistingSplats(viewer) {
    try {
      if (viewer.splatMesh?.disposeSplatTree) {
        viewer.splatMesh.disposeSplatTree();
      }

      if (viewer.reset) {
        await viewer.reset();
      } else if (viewer.getSceneCount && viewer.removeSplatScenes) {
        const sceneCount = viewer.getSceneCount();
        if (sceneCount > 0) {
          const scenesToRemove = Array.from(
            { length: sceneCount },
            (_, i) => i
          );
          await viewer.removeSplatScenes(scenesToRemove, false);
        }
      }

      loadedSplatIdsRef.current.clear();
    } catch (e) {
      console.error("Error clearing existing content:", e);
    }
  }

  async function downloadSplatFiles(viewer, cellsToLoad) {
    const splatBuffers = [];
    const splatConfigs = [];
    const totalFiles = cellsToLoad.length;
    let filesLoaded = 0;

    // Force a render before starting downloads to ensure UI is updated
    if (viewer.forceRender) {
      viewer.forceRender();
    }

    // Process files in batches to allow UI updates between downloads
    const batchSize = 5;
    for (let i = 0; i < cellsToLoad.length; i += batchSize) {
      const batch = cellsToLoad.slice(i, i + batchSize);

      // Process this batch in parallel
      await Promise.all(
        batch.map(async (cellId) => {
          const filePath = `${_SPLAT_FOLDER}/${cellId}.ply`;
          console.log(`Downloading: ${filePath}`);

          try {
            if (typeof viewer.downloadSplatSceneToSplatBuffer === "function") {
              const buffer = await viewer.downloadSplatSceneToSplatBuffer(
                filePath,
                5, // splatAlphaRemovalThreshold
                undefined,
                false, // showLoadingUI
                undefined,
                GaussianSplats3D.SceneFormat.Ply
              );

              if (buffer) {
                splatBuffers.push(buffer);
                splatConfigs.push({
                  position: [0, 0, 0],
                  rotation: [0, 0, 0, 1],
                  scale: [1, 1, 1],
                  splatAlphaRemovalThreshold: 5,
                });
                loadedSplatIdsRef.current.add(cellId);
              }
            } else {
              // Fallback for older API
              splatBuffers.push(null);
              splatConfigs.push({
                path: filePath,
                position: [0, 0, 0],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1],
                splatAlphaRemovalThreshold: 5,
                showLoadingUI: false,
                format: GaussianSplats3D.SceneFormat.Ply,
                progressiveLoad: false,
              });
            }
          } catch (error) {
            console.error(`Error downloading cell ${cellId}:`, error);
          }

          // Update progress for this file
          filesLoaded++;
          onProgress(
            20 + Math.round((filesLoaded / totalFiles) * 70),
            `Downloaded ${filesLoaded}/${totalFiles} files`
          );
        })
      );

      // Give the main thread some time to breathe between batches
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Force a render to keep the UI responsive
      if (viewer.forceRender) {
        viewer.forceRender();
      }
    }

    return { splatBuffers, splatConfigs };
  }

  async function addSplatsToScene(viewer, splatBuffers, splatConfigs) {
    // Add a slight delay to ensure UI updates
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      // Ensure controls remain enabled
      if (viewer && viewer.controls) {
        viewer.controls.enabled = true;
      }

      if (
        typeof viewer.addSplatBuffers === "function" &&
        splatBuffers.some((b) => b !== null)
      ) {
        // Filter out null buffers
        const validBuffers = splatBuffers.filter((b) => b !== null);
        const validConfigs = splatConfigs.slice(0, validBuffers.length);

        console.log(`Adding ${validBuffers.length} splat buffers to scene`);
        onProgress(95, "Adding splats to scene...");

        await viewer.addSplatBuffers(
          validBuffers,
          validConfigs,
          true, // finalBuild
          false, // showLoadingUI
          false, // showLoadingUIForSplatTreeBuild
          false, // replaceExisting
          true, // enableRenderBeforeFirstSort
          true // preserveVisibleRegion
        );
      } else {
        // Fallback method
        console.log("Using fallback: Adding splat scenes sequentially");

        // Disable rendering temporarily
        const originalRenderMode = viewer.renderMode;
        viewer.setRenderMode(GaussianSplats3D.RenderMode.Never);

        // Add scenes without rendering between
        for (const config of splatConfigs) {
          if (config.path) {
            await viewer.addSplatScene(config.path, config);
          }
        }

        // Re-enable rendering
        viewer.setRenderMode(originalRenderMode);
      }

      console.log("All splats added to scene");

      // Hide the bounding box after splats are loaded
      if (boundingBoxRef.current) {
        boundingBoxRef.current.visible = false;
        boundingEdgesRef.current.visible = false;
        // Reset color back to blue for next use
        boundingBoxRef.current.material.color.set(0x0000ff);
      }

      // Reset loading state to allow mouse movement to affect box again
      isLoadingRef.current = false;
    } catch (error) {
      console.error("Error adding splats to scene:", error);
      // Reset color back to blue if there's an error
      if (boundingBoxRef.current) {
        boundingBoxRef.current.material.color.set(0x0000ff); // Blue color
      }
      // Make sure to reset loading state
      isLoadingRef.current = false;
      throw error;
    }
  }

  function loadPointCloud(threeScene, viewer) {
    const loader = new PLYLoader();

    // Set the loading state to true initially
    isLoadingRef.current = true;

    // Show progress immediately
    onProgress(5, "Loading point cloud...");

    loader.load(
      _POINT_CLOUD_PATH,
      // Success callback
      (geometry) => {
        console.log("Point cloud loaded successfully");
        const material = new THREE.PointsMaterial({
          size: _POINT_SIZE,
          vertexColors: true,
          sizeAttenuation: true,
          alphaTest: 0.5,
          transparent: true,
          depthWrite: false,
          map: createCircleTexture(),
        });
        const pointCloud = new THREE.Points(geometry, material);
        threeScene.add(pointCloud);

        // Get initial position and set orange bounding box
        const initialX = Math.floor(_DEFAULT_CAMERA.lookAt[0]);
        const initialY = Math.floor(_DEFAULT_CAMERA.lookAt[1]);

        // Calculate grid and update bounding box
        const startX = initialX - _HALF_BOX_SIZE;
        const startY = initialY - _HALF_BOX_SIZE;
        const boxCenterX = startX + _HALF_BOX_SIZE + 0.5;
        const boxCenterY = startY + _HALF_BOX_SIZE + 0.5;

        // Calculate Z range for this grid
        const zRange = computeZRange(startX, startY);
        zRangeRef.current = zRange;

        // Update bounding box geometry with the proper z-range
        updateBoundingBoxGeometry(zRange.minZ, zRange.maxZ);

        // Update box position and make it visible with orange color
        updateBoundingBox(boxCenterX, boxCenterY);
        if (boundingBoxRef.current) {
          boundingBoxRef.current.material.color.set(0xff8800); // Orange color
          boundingBoxRef.current.visible = true;
          boundingEdgesRef.current.visible = true;
        }

        // IMPORTANT: Force a render to make the point cloud visible immediately
        viewer.forceRender();

        // A slight delay to ensure the point cloud is visible before starting splat loading
        setTimeout(() => {
          // Show point cloud and prepare to load splats
          onProgress(35, "Point cloud loaded, loading splats...");

          // Now load the initial splats (the orange box will stay visible until splats are loaded)
          loadSplatsForGrid(initialX, initialY);
        }, 500); // Small delay to ensure the point cloud renders
      },
      // Progress callback
      (xhr) => {
        const percentComplete = (xhr.loaded / xhr.total) * 100;
        console.log(`Point cloud loading: ${Math.round(percentComplete)}%`);
        onProgress(Math.round(percentComplete * 0.3), "Loading point cloud...");
      },
      // Error callback
      (error) => {
        console.error("Error loading point cloud:", error);
        onProgress(30, "Point cloud failed, loading splats...");

        // Even if point cloud fails, try to load splats with default coordinates
        const initialX = Math.floor(_DEFAULT_CAMERA.lookAt[0]);
        const initialY = Math.floor(_DEFAULT_CAMERA.lookAt[1]);

        // Set orange bounding box
        const startX = initialX - _HALF_BOX_SIZE;
        const startY = initialY - _HALF_BOX_SIZE;
        const boxCenterX = startX + _HALF_BOX_SIZE + 0.5;
        const boxCenterY = startY + _HALF_BOX_SIZE + 0.5;

        updateBoundingBox(boxCenterX, boxCenterY);
        if (boundingBoxRef.current) {
          boundingBoxRef.current.material.color.set(0xff8800); // Orange color
          boundingBoxRef.current.visible = true;
          boundingEdgesRef.current.visible = true;
        }

        // IMPORTANT: Force a render to make the box visible immediately
        viewer.forceRender();

        setTimeout(() => {
          loadSplatsForGrid(initialX, initialY);
        }, 300);
      }
    );
  }

  function cleanupResources(viewer, threeScene) {
    // Clean up viewer
    if (viewer) {
      viewer.setRenderMode(GaussianSplats3D.RenderMode.Never);

      if (viewer.renderLoop) {
        viewer.renderLoop.stop();
      }

      // Cancel our controls animation loop
      if (viewer._controlsAnimationId) {
        cancelAnimationFrame(viewer._controlsAnimationId);
      }

      if (viewer.splatMesh) {
        if (viewer.splatMesh.geometry) viewer.splatMesh.geometry.dispose();
        if (viewer.splatMesh.material) viewer.splatMesh.material.dispose();
        if (viewer.splatMesh.parent)
          viewer.splatMesh.parent.remove(viewer.splatMesh);
      }

      if (viewer.renderer) {
        viewer.renderer.dispose();
        viewer.renderer.forceContextLoss();
        const gl = viewer.renderer.getContext();
        if (gl) {
          const loseContext = gl.getExtension("WEBGL_lose_context");
          if (loseContext) loseContext.loseContext();
        }
        viewer.renderer.domElement = null;
      }
    }

    // Clean up THREE scene
    if (threeScene) {
      if (threeScene.userData?.cleanup) {
        threeScene.userData.cleanup();
      }

      threeScene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });

      while (threeScene.children.length > 0) {
        threeScene.remove(threeScene.children[0]);
      }
    }

    // Clean up DOM elements
    if (viewerRef.current?.firstChild) {
      viewerRef.current.removeChild(viewerRef.current.firstChild);
    }

    // Clear refs
    viewerInstanceRef.current = null;
    boundingBoxRef.current = null;
    boundingEdgesRef.current = null;
    loadedSplatIdsRef.current.clear();

    // Force garbage collection if available
    if (window.gc) window.gc();
  }

  if (!isMounted) return null;

  return <div ref={viewerRef} style={{ width: "100%", height: "100vh" }} />;
}

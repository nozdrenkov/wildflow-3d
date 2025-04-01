import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

const _LOCAL_DATA = true;

export default function Viewer3D({ modelId, onProgress }) {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const boundingBoxRef = useRef(null);
  const boundingEdgesRef = useRef(null);
  const loadedSplatIdsRef = useRef(new Set());
  const [isMounted, setIsMounted] = useState(false);
  const currentSelectionRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !viewerRef.current) return;

    const currentViewerRef = viewerRef.current;
    const threeScene = new THREE.Scene();
    let metadata = null;

    // Z values for bounding box (default, will be updated from metadata)
    const boxZ = {
      minZ: -4.1188249588012695,
      maxZ: -3.3649239540100098,
    };

    // Create circular point texture
    const createCircleTexture = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext("2d");

      // Draw white circle on transparent background
      context.beginPath();
      context.arc(32, 32, 30, 0, 2 * Math.PI);
      context.fillStyle = "white";
      context.fill();

      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };

    // Create bounding box and its edges
    const createBoundingBox = () => {
      // Remove previous bounding box if exists
      if (boundingBoxRef.current && boundingBoxRef.current.parent) {
        threeScene.remove(boundingBoxRef.current);
        threeScene.remove(boundingEdgesRef.current);
      }

      // Create a new 5x5 box
      const boxWidth = 5;
      const boxHeight = 5;
      const boxDepth = boxZ.maxZ - boxZ.minZ;

      const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
      const edges = new THREE.EdgesGeometry(geometry);

      const edgesMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        visible: true,
      });

      const boxMaterial = new THREE.MeshBasicMaterial({
        color: 0x0000ff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true,
        visible: true,
      });

      const boundingBox = new THREE.Mesh(geometry, boxMaterial);
      const boundingEdges = new THREE.LineSegments(edges, edgesMaterial);

      // Set initial position (will be updated on mouse move)
      boundingBox.position.set(0, 0, (boxZ.minZ + boxZ.maxZ) / 2);
      boundingEdges.position.copy(boundingBox.position);

      // Add to scene
      threeScene.add(boundingBox);
      threeScene.add(boundingEdges);

      // Store references
      boundingBoxRef.current = boundingBox;
      boundingEdgesRef.current = boundingEdges;

      return { boundingBox, boundingEdges };
    };

    // Fetch metadata file first
    fetch("/m9/metadata.json")
      .then((response) => response.json())
      .then((data) => {
        metadata = data;
        console.log(
          "Loaded metadata for",
          Object.keys(metadata).length,
          "cells"
        );
        initializeViewer();
      })
      .catch((error) => {
        console.error("Error loading metadata:", error);
        // Continue with initialization even if metadata fails
        initializeViewer();
      });

    function initializeViewer() {
      // Camera parameters from comments
      const camera = {
        position: [-6.36302, -7.56634, 1.84438],
        lookAt: [-7.69713, -7.04284, -3.20002],
        up: [0.0, 1.0, 0.0],
        scale: [1.0, 1.0, 1.0],
        rotation: [0, 0, 0, 1],
      };

      // Load point cloud first
      const pointCloudModelUrl = `/m9/point_cloud.ply`;

      // Create initial bounding box
      const { boundingBox, boundingEdges } = createBoundingBox();

      // Initialize viewer right away
      const viewer = new GaussianSplats3D.Viewer({
        cameraUp: camera.up,
        initialCameraPosition: camera.position,
        initialCameraLookAt: camera.lookAt,
        rootElement: viewerRef.current,
        sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
        crossOrigin: "anonymous",
        threeScene: threeScene,
        selfDrivenMode: true,
        useWorkers: true,
        workerConfig: {
          crossOriginIsolated: true,
        },
        dynamicScene: true,
        freeIntermediateSplatData: false,
        inMemoryCompressionLevel: 0,
        renderMode: GaussianSplats3D.RenderMode.OnChange,
        progressCallback: (percent, message) => {
          console.log(`Loading progress: ${percent}% - ${message}`);
          onProgress(percent, message);
        },
      });
      viewerInstanceRef.current = viewer;

      // Start the viewer
      viewer.start();

      // Modify the loadSplatsForGrid function to load first, then display at once
      const loadSplatsForGrid = async (centerX, centerY) => {
        try {
          // Always show progress bar immediately
          onProgress(5, "Preparing to load splats...");
          console.log(
            `Starting to load splats for grid centered at ${centerX},${centerY}`
          );

          const boxSize = 5;
          const halfSize = Math.floor(boxSize / 2);

          // Calculate top-left corner of the grid
          const startX = Math.floor(centerX) - halfSize;
          const startY = Math.floor(centerY) - halfSize;

          // Generate all 25 cell IDs for the 5x5 grid
          const cellsToLoad = [];
          for (let y = 0; y < boxSize; y++) {
            for (let x = 0; x < boxSize; x++) {
              const cellX = startX + x;
              const cellY = startY + y;
              const cellId = `${cellX}x${cellY}y1s`;
              cellsToLoad.push(cellId);
            }
          }

          // Store current selection for reference
          currentSelectionRef.current = {
            startX,
            startY,
            boxSize,
            cellIds: cellsToLoad,
          };

          console.log(`Generated ${cellsToLoad.length} cell IDs to load`);

          // First: Clear existing content
          onProgress(10, "Clearing previous splats...");
          try {
            if (viewer.splatMesh && viewer.splatMesh.disposeSplatTree) {
              viewer.splatMesh.disposeSplatTree();
            }

            // Try to reset or clear scenes
            try {
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
            } catch (e) {
              console.error("Error resetting scenes:", e);
            }

            // Clear loaded cells record
            loadedSplatIdsRef.current.clear();
          } catch (e) {
            console.error("Error clearing existing content:", e);
          }

          // PHASE 1: Load all splat files into buffers (without displaying)
          onProgress(20, "Downloading splat files...");
          const splatBuffers = [];
          const splatConfigs = [];
          const totalFiles = cellsToLoad.length;
          let filesLoaded = 0;

          for (const cellId of cellsToLoad) {
            const filePath = `/m9/1s/${cellId}.ply`;
            console.log(`Downloading: ${filePath}`);

            // Update z-height from metadata if available
            if (metadata && metadata[cellId]) {
              boxZ.minZ = metadata[cellId].minZ;
              boxZ.maxZ = metadata[cellId].maxZ;
            }

            try {
              // Check if downloadSplatSceneToSplatBuffer exists
              if (
                typeof viewer.downloadSplatSceneToSplatBuffer === "function"
              ) {
                // Download only - don't add to scene yet
                const buffer = await viewer.downloadSplatSceneToSplatBuffer(
                  filePath,
                  5, // splatAlphaRemovalThreshold
                  undefined,
                  false, // showLoadingUI - we're managing our own progress
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
                // If buffer API isn't available, just store the path for loading in phase 2
                splatBuffers.push(null);
                splatConfigs.push({
                  path: filePath,
                  position: [0, 0, 0],
                  rotation: [0, 0, 0, 1],
                  scale: [1, 1, 1],
                  splatAlphaRemovalThreshold: 5,
                  showLoadingUI: false, // We're managing our own progress
                  format: GaussianSplats3D.SceneFormat.Ply,
                  progressiveLoad: false,
                });
              }

              // Update progress
              filesLoaded++;
              onProgress(
                20 + Math.round((filesLoaded / totalFiles) * 70),
                `Downloaded ${filesLoaded}/${totalFiles} files`
              );
            } catch (error) {
              console.error(`Error downloading cell ${cellId}:`, error);
              filesLoaded++;
              onProgress(
                20 + Math.round((filesLoaded / totalFiles) * 70),
                `Downloaded ${filesLoaded}/${totalFiles} files (failed on ${cellId})`
              );
            }
          }

          // PHASE 2: Add all splats to the scene at once
          onProgress(90, "Preparing to display all splats...");
          console.log(
            `Downloaded ${
              splatBuffers.filter((b) => b !== null).length
            } buffers, now adding to scene`
          );

          try {
            // Add a slight delay to ensure UI updates
            await new Promise((resolve) => setTimeout(resolve, 100));

            if (
              typeof viewer.addSplatBuffers === "function" &&
              splatBuffers.some((b) => b !== null)
            ) {
              // Filter out any null buffers
              const validBuffers = splatBuffers.filter((b) => b !== null);
              const validConfigs = splatConfigs.slice(0, validBuffers.length);

              // Add all buffers at once
              console.log(
                `Adding ${validBuffers.length} splat buffers to scene at once`
              );
              onProgress(95, "Adding all splats to scene...");

              await viewer.addSplatBuffers(
                validBuffers,
                validConfigs,
                true, // finalBuild
                false, // showLoadingUI - we're handling our own progress
                false, // showLoadingUIForSplatTreeBuild
                false, // replaceExisting
                true, // enableRenderBeforeFirstSort
                true // preserveVisibleRegion
              );
            } else {
              // Fall back to adding scenes one by one, but still without displaying until all are added
              console.log("Using fallback: Adding splat scenes sequentially");

              // Disable rendering temporarily
              const originalRenderMode = viewer.renderMode;
              viewer.setRenderMode(GaussianSplats3D.RenderMode.Never);

              // Add all scenes without rendering between
              for (let i = 0; i < splatConfigs.length; i++) {
                const config = splatConfigs[i];
                if (config.path) {
                  await viewer.addSplatScene(config.path, config);
                }
              }

              // Re-enable rendering once all scenes are added
              viewer.setRenderMode(originalRenderMode);
            }

            console.log("All splats added to scene");

            // Update bounding box height based on metadata
            boundingBox.geometry.dispose();
            boundingBox.geometry = new THREE.BoxGeometry(
              boxSize,
              boxSize,
              boxZ.maxZ - boxZ.minZ
            );
            boundingBox.position.z = (boxZ.minZ + boxZ.maxZ) / 2;

            boundingEdges.geometry.dispose();
            boundingEdges.geometry = new THREE.EdgesGeometry(
              boundingBox.geometry
            );
            boundingEdges.position.copy(boundingBox.position);

            // Show completion progress and keep it visible briefly
            onProgress(100, "Loading complete");

            // Keep progress bar visible for a moment after completion
            await new Promise((resolve) => setTimeout(resolve, 1500));
            onProgress(0, "");
          } catch (error) {
            console.error("Error adding splats to scene:", error);
            onProgress(100, "Error displaying splats");
            setTimeout(() => onProgress(0, ""), 2000);
          }
        } catch (error) {
          console.error("Error in main loading process:", error);
          onProgress(100, "Error loading splats");
          setTimeout(() => onProgress(0, ""), 2000);
        }
      };

      // Load the point cloud
      const loader = new PLYLoader();
      loader.load(
        pointCloudModelUrl,
        // Success callback
        (geometry) => {
          console.log("Point cloud loaded successfully");
          const material = new THREE.PointsMaterial({
            size: 0.03,
            vertexColors: true,
            sizeAttenuation: true,
            alphaTest: 0.5,
            transparent: true,
            depthWrite: false,
            map: createCircleTexture(),
          });
          const pointCloud = new THREE.Points(geometry, material);
          threeScene.add(pointCloud);

          // Show point cloud immediately
          onProgress(35, "Point cloud loaded, loading splats...");

          // Load initial splats at camera position after point cloud is loaded
          console.log("Loading initial splats near camera position");
          const initialX = Math.floor(camera.lookAt[0]);
          const initialY = Math.floor(camera.lookAt[1]);
          loadSplatsForGrid(initialX, initialY);
        },
        // Progress callback
        (xhr) => {
          const percentComplete = (xhr.loaded / xhr.total) * 100;
          console.log(`Point cloud loading: ${Math.round(percentComplete)}%`);
          // Keep progress under 30% for point cloud to leave room for splats
          onProgress(
            Math.round(percentComplete * 0.3),
            "Loading point cloud..."
          );
        },
        // Error callback
        (error) => {
          console.error("Error loading point cloud:", error);
          // Still try to load initial splats even if point cloud fails
          console.log("Loading initial splats at default position");
          onProgress(30, "Point cloud failed, loading splats...");
          // Try with some default coordinates where we know there are splats
          loadSplatsForGrid(-10, -10);
        }
      );

      // 1. Fix the mousemove event listener to ensure the blue box always moves
      viewer.renderer.domElement.addEventListener("mousemove", (event) => {
        // Calculate mouse position in normalized device coordinates
        const rect = viewer.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update the raycaster
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, viewer.camera);

        // Project ray into the scene
        const ray = raycaster.ray;

        // Find the intersection with a horizontal plane at z = (boxZ.minZ + boxZ.maxZ) / 2
        const planeZ = (boxZ.minZ + boxZ.maxZ) / 2;
        const t = (planeZ - ray.origin.z) / ray.direction.z;

        // If the ray doesn't intersect with the plane, skip
        if (t > 0) {
          // Calculate intersection point
          const point = new THREE.Vector3();
          point.copy(ray.origin).addScaledVector(ray.direction, t);

          // Calculate grid cell coordinates (center of the 1m cell the cursor is in)
          const gridX = Math.floor(point.x) + 0.5;
          const gridY = Math.floor(point.y) + 0.5;

          // For a 5x5m box, get the center coordinate of the box (should be integer + 0.5)
          // This ensures the cursor is in the center of the box
          const boxCenterX = Math.floor(gridX - 2) + 2.5; // Center of 5x5 box
          const boxCenterY = Math.floor(gridY - 2) + 2.5; // Center of 5x5 box

          // Always update bounding box position, even if in loaded area
          boundingBox.position.set(boxCenterX, boxCenterY, planeZ);
          boundingEdges.position.copy(boundingBox.position);

          // Check if cursor is within the currently loaded area
          let isInLoadedArea = false;
          if (currentSelectionRef.current) {
            const { startX, startY, boxSize } = currentSelectionRef.current;
            if (
              Math.floor(point.x) >= startX &&
              Math.floor(point.x) < startX + boxSize &&
              Math.floor(point.y) >= startY &&
              Math.floor(point.y) < startY + boxSize
            ) {
              isInLoadedArea = true;
            }
          }

          // Set visibility based on whether cursor is in loaded area
          boundingBox.visible = !isInLoadedArea;
          boundingEdges.visible = !isInLoadedArea;
        }
      });

      // 2. Make sure click events are properly handled
      // Add this right after you start the viewer to ensure camera controls work
      console.log("Viewer started with camera controls");

      // 3. Fix the double-click handler to ensure it properly loads areas
      viewer.renderer.domElement.addEventListener("dblclick", (event) => {
        console.log("Double-click detected");

        // Show progress immediately to give feedback
        onProgress(5, "Processing double-click...");

        // Calculate mouse position in normalized device coordinates
        const rect = viewer.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update the raycaster
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, viewer.camera);

        // Project ray into the scene
        const ray = raycaster.ray;

        // Find the intersection with a horizontal plane
        const planeZ = (boxZ.minZ + boxZ.maxZ) / 2;
        const t = (planeZ - ray.origin.z) / ray.direction.z;

        // If the ray intersects with the plane
        if (t > 0) {
          // Calculate intersection point
          const point = new THREE.Vector3();
          point.copy(ray.origin).addScaledVector(ray.direction, t);

          console.log(
            `Double-click intersection at: ${point.x}, ${point.y}, ${point.z}`
          );
          loadSplatsForGrid(point.x, point.y).catch((error) => {
            console.error("Error in loadSplatsForGrid:", error);
            onProgress(0, "");
          });
        } else {
          // Clear progress if no intersection
          console.log("Double-click: No intersection with plane");
          onProgress(0, "");
        }
      });
    }

    return () => {
      const viewer = viewerInstanceRef.current;
      if (viewer) {
        viewer.setRenderMode(GaussianSplats3D.RenderMode.Never);

        if (viewer.renderLoop) {
          viewer.renderLoop.stop();
        }

        if (viewer.splatMesh) {
          if (viewer.splatMesh.geometry) {
            viewer.splatMesh.geometry.dispose();
          }
          if (viewer.splatMesh.material) {
            viewer.splatMesh.material.dispose();
          }
          if (viewer.splatMesh.parent) {
            viewer.splatMesh.parent.remove(viewer.splatMesh);
          }
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

      if (threeScene?.userData?.cleanup) {
        threeScene.userData.cleanup();
      }

      threeScene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
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

      if (currentViewerRef && currentViewerRef.firstChild) {
        currentViewerRef.removeChild(currentViewerRef.firstChild);
      }

      viewerInstanceRef.current = null;
      boundingBoxRef.current = null;
      boundingEdgesRef.current = null;
      loadedSplatIdsRef.current.clear();

      if (window.gc) {
        window.gc();
      }
    };
  }, [isMounted, modelId, onProgress]);

  if (!isMounted) return null;

  return <div ref={viewerRef} style={{ width: "100%", height: "100vh" }} />;
}

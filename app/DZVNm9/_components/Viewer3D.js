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

      // Function to load splats for a 5x5 grid centered at specified coordinates
      const loadSplatsForGrid = async (centerX, centerY) => {
        try {
          console.log(
            `Starting to load splats for grid centered at ${centerX},${centerY}`
          );
          const boxSize = 5;
          const halfSize = Math.floor(boxSize / 2);

          // Calculate top-left corner of the grid
          const startX = Math.floor(centerX) - halfSize;
          const startY = Math.floor(centerY) - halfSize;

          // Keep track of cell IDs that should be loaded
          const cellsToLoad = new Set();

          // Generate all 25 cell IDs for the 5x5 grid
          for (let y = 0; y < boxSize; y++) {
            for (let x = 0; x < boxSize; x++) {
              const cellX = startX + x;
              const cellY = startY + y;
              const cellId = `${cellX}x${cellY}y1s`;
              cellsToLoad.add(cellId);
            }
          }

          // Store current selection for reference
          currentSelectionRef.current = {
            startX,
            startY,
            boxSize,
            cellIds: Array.from(cellsToLoad),
          };

          console.log(
            `Generated ${cellsToLoad.size} cell IDs to load:`,
            Array.from(cellsToLoad)
          );

          // Show loading indicator
          onProgress(0, "Downloading splat files...");

          // Determine which cells need to be removed
          const cellsToRemove = [];
          for (const loadedCellId of loadedSplatIdsRef.current) {
            if (!cellsToLoad.has(loadedCellId)) {
              cellsToRemove.push(loadedCellId);
            }
          }

          // First: Instead of trying to remove specific scenes, let's clear all scenes
          // and reload everything, which is more reliable
          if (viewer.splatMesh) {
            onProgress(10, "Clearing existing scenes...");
            try {
              if (viewer.splatMesh.disposeSplatTree) {
                viewer.splatMesh.disposeSplatTree();
              }

              // Get scene count - use a different approach
              let sceneCount = 0;
              try {
                // Try to determine scene count from the viewer
                sceneCount = viewer.getSceneCount ? viewer.getSceneCount() : 0;
              } catch (e) {
                console.log(
                  "Could not get scene count using getSceneCount, trying alternative"
                );
                // Alternative method if getSceneCount is not available
                if (
                  viewer.splatMesh &&
                  Array.isArray(viewer.splatMesh.splatBuffers)
                ) {
                  sceneCount = viewer.splatMesh.splatBuffers.length;
                }
              }

              if (sceneCount > 0) {
                console.log(`Removing ${sceneCount} existing scenes`);
                if (viewer.removeSplatScenes) {
                  // If removeSplatScenes is available
                  const scenesToRemove = Array.from(
                    { length: sceneCount },
                    (_, i) => i
                  );
                  await viewer.removeSplatScenes(scenesToRemove, false);
                } else {
                  // Alternative: Reset the viewer completely
                  console.log("Using alternative scene removal approach");
                  await viewer.reset();
                }
              }

              // Clear loaded cells record
              loadedSplatIdsRef.current.clear();
            } catch (e) {
              console.error("Error clearing scenes:", e);
              // Continue anyway, we'll try to add new scenes
            }
          }

          // Second: Download all splat buffers in parallel
          onProgress(20, "Downloading new splat files...");
          const splatBuffers = [];
          const splatConfigs = [];
          const successfullyLoadedCellIds = [];
          let totalFiles = cellsToLoad.size;
          let filesLoaded = 0;

          // Create array of download promises - fixing the syntax error here
          const downloadPromises = Array.from(cellsToLoad).map(
            async (cellId) => {
              const filePath = `/m9/1s/${cellId}.ply`;
              console.log(`Downloading: ${filePath}`);

              // Update z-height from metadata if available
              if (metadata && metadata[cellId]) {
                console.log(`Found metadata for ${cellId}:`, metadata[cellId]);
                boxZ.minZ = metadata[cellId].minZ;
                boxZ.maxZ = metadata[cellId].maxZ;
              }

              try {
                // Check if downloadSplatSceneToSplatBuffer exists
                if (
                  typeof viewer.downloadSplatSceneToSplatBuffer === "function"
                ) {
                  // Download the splat file to a buffer
                  const buffer = await viewer.downloadSplatSceneToSplatBuffer(
                    filePath,
                    20, // splatAlphaRemovalThreshold
                    undefined,
                    false, // showLoadingUI
                    undefined,
                    GaussianSplats3D.SceneFormat.Ply
                  );

                  // If successfully downloaded, store the buffer and configuration
                  if (buffer) {
                    splatBuffers.push(buffer);
                    splatConfigs.push({
                      position: [0, 0, 0],
                      rotation: [0, 0, 0, 1],
                      scale: [1, 1, 1],
                      splatAlphaRemovalThreshold: 5,
                      userData: { cellId },
                    });
                    successfullyLoadedCellIds.push(cellId);
                  }
                } else {
                  // This will be handled in the next phase
                  // Just track it as successfully loaded for now
                  successfullyLoadedCellIds.push(cellId);
                }

                // Update progress
                filesLoaded++;
                onProgress(
                  20 + Math.round((filesLoaded / totalFiles) * 30),
                  `Downloaded ${filesLoaded}/${totalFiles} files`
                );
              } catch (error) {
                console.error(`Error downloading cell ${cellId}:`, error);
                filesLoaded++;
                onProgress(
                  20 + Math.round((filesLoaded / totalFiles) * 30),
                  `Downloaded ${filesLoaded}/${totalFiles} files`
                );
              }
            }
          );

          // Wait for all downloads to complete
          await Promise.all(downloadPromises);
          console.log(
            `Successfully downloaded ${splatBuffers.length} splat buffers`
          );

          // Second: Remove cells that are outside the new selection
          if (cellsToRemove.length > 0) {
            console.log(
              `Removing ${cellsToRemove.length} cells outside selection`
            );
            onProgress(60, "Removing old splats...");

            // Get the scene IDs for the cells to remove
            const sceneCount = viewer.getSceneCount();
            const scenesToRemove = [];

            for (let i = 0; i < sceneCount; i++) {
              const sceneInfo = viewer.getSceneInfo(i);
              if (
                sceneInfo &&
                cellsToRemove.includes(sceneInfo.userData?.cellId)
              ) {
                scenesToRemove.push(i);
              }
            }

            // Remove the scenes
            if (scenesToRemove.length > 0) {
              if (viewer.splatMesh) {
                viewer.splatMesh.disposeSplatTree();
              }
              await viewer.removeSplatScenes(scenesToRemove, false);

              // Update loaded cells set
              for (const cellId of cellsToRemove) {
                loadedSplatIdsRef.current.delete(cellId);
              }
            }
          }

          // Third: Add all new splat buffers at once
          if (splatBuffers.length > 0) {
            console.log(
              `Adding ${splatBuffers.length} new splat buffers to the scene`
            );
            onProgress(75, "Adding new splats...");

            try {
              // Add all buffers at once
              await viewer.addSplatBuffers(
                splatBuffers,
                splatConfigs,
                false, // finalBuild
                false, // showLoadingUI
                false, // showLoadingUIForSplatTreeBuild
                false, // replaceExisting
                false, // enableRenderBeforeFirstSort
                true // preserveVisibleRegion
              );

              // Update loaded cells set with successfully loaded cells
              for (const cellId of successfullyLoadedCellIds) {
                loadedSplatIdsRef.current.add(cellId);
              }

              console.log(`Successfully added all splat buffers to the scene`);
            } catch (error) {
              console.error(`Error adding splat buffers to scene:`, error);
            }
          }

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

          onProgress(100, "Loading complete");
          setTimeout(() => onProgress(0, ""), 1000); // Clear progress after 1 second
        } catch (error) {
          console.error("Error loading splats for grid:", error);
          onProgress(0, ""); // Clear progress on error
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

          // Load initial splats at camera position after point cloud is loaded
          console.log("Loading initial splats near camera position");
          const initialX = Math.floor(camera.lookAt[0]);
          const initialY = Math.floor(camera.lookAt[1]);
          loadSplatsForGrid(initialX, initialY);

          // Set up raycasting for cursor tracking
          const raycaster = new THREE.Raycaster();
          const mouse = new THREE.Vector2();

          // Add mousemove event listener
          viewer.renderer.domElement.addEventListener("mousemove", (event) => {
            // Calculate mouse position in normalized device coordinates
            const rect = viewer.renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            // Update the raycaster
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

              // Truncate to integer grid (1m)
              const gridX = Math.floor(point.x);
              const gridY = Math.floor(point.y);

              // Center the box on the grid cell (half of 5m = 2.5m)
              const centerX = gridX + 2.5;
              const centerY = gridY + 2.5;

              // Update bounding box position
              boundingBox.position.set(centerX, centerY, planeZ);
              boundingEdges.position.copy(boundingBox.position);
            }
          });

          // Add double-click event listener to load splats
          viewer.renderer.domElement.addEventListener("dblclick", (event) => {
            // Calculate mouse position in normalized device coordinates
            const rect = viewer.renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            // Update the raycaster
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

              // Load splats for 5x5 grid centered at this point
              loadSplatsForGrid(point.x, point.y);
            }
          });
        },
        // Progress callback
        (xhr) => {
          const percentComplete = (xhr.loaded / xhr.total) * 100;
          console.log(`Point cloud loading: ${Math.round(percentComplete)}%`);
          onProgress(Math.round(percentComplete), "Loading point cloud...");
        },
        // Error callback
        (error) => {
          console.error("Error loading point cloud:", error);
          // Still try to load initial splats even if point cloud fails
          console.log("Loading initial splats at default position");
          // Try with some default coordinates where we know there are splats
          loadSplatsForGrid(-10, -10);
        }
      );
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

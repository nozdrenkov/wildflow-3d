import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";

const _LOCAL_DATA = false;

export default function Viewer3D({ modelId, onProgress }) {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !viewerRef.current) return;

    const currentViewerRef = viewerRef.current;

    // const prefix = _LOCAL_DATA
    //   ? `/${modelId}`
    //   : `https://storage.googleapis.com/wildflow/${modelId}`;
    const configUrl = `https://storage.googleapis.com/wildflow/C0r4Lm7/metadata.json?v=2`;

    fetch(configUrl)
      .then((response) => response.json())
      .then((config) => {
        console.log(`Camera config: ${JSON.stringify(config, null, 2)}`);
        const camera = config.camera;
        const viewer = new GaussianSplats3D.Viewer({
          cameraUp: camera.cameraUp,
          initialCameraPosition: camera.initialCameraPosition,
          initialCameraLookAt: camera.initialCameraLookAt,
          rootElement: viewerRef.current,
          sceneRevealMode: GaussianSplats3D.SceneRevealMode.Gradual,
          crossOrigin: "anonymous",
          threeScene: new THREE.Scene(),
          selfDrivenMode: true,
          useWorkers: true,
          workerConfig: {
            crossOriginIsolated: true,
          },
          progressCallback: (percent, message) => {
            onProgress(percent, message);
          },
        });
        viewerInstanceRef.current = viewer;

        // Get reference to the Three.js scene
        const threeScene = viewer.threeScene;

        const model = config.model;
        const modelUrl = `https://storage.googleapis.com/wildflow/C0r4Lm7/${model.filePath}`;
        viewer
          .addSplatScene(modelUrl, {
            splatAlphaRemovalThreshold: 5,
            showLoadingUI: false,
            position: model.position || [0, 1, 0],
            rotation: model.rotation || [0, 0, 0, 1],
            scale: model.scale || [1, 1, 1],
            progressiveLoad: true,
          })
          .then(() => {
            console.log("Splat scene added successfully");

            // Create shared raycaster and mouse vector
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();

            // Track currently highlighted box and its edges
            let currentHighlight = null;
            let currentEdges = null;

            // Create boxes for each tile
            config.grid.tiles.forEach((tile) => {
              // Create geometry for this tile with modified Z range
              const geometry = new THREE.BoxGeometry(
                tile.maxX - tile.minX, // width
                tile.maxY - tile.minY, // height
                4 // depth (averageZ ± 2)
              );

              // Create edges
              const edges = new THREE.EdgesGeometry(geometry);
              const edgesMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
                visible: false, // Hide edges by default
              });
              const boundingEdges = new THREE.LineSegments(
                edges,
                edgesMaterial
              );

              // Create transparent faces
              const boxMaterial = new THREE.MeshBasicMaterial({
                color: 0x0000ff,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthWrite: false,
                depthTest: true,
                visible: false, // Hide faces by default
              });
              const boundingBox = new THREE.Mesh(geometry, boxMaterial);

              // Store reference to corresponding edges in the box
              boundingBox.userData.edges = boundingEdges;

              // Position the box at the center of min/max coordinates
              const centerX = (tile.minX + tile.maxX) / 2;
              const centerY = (tile.minY + tile.maxY) / 2;
              const centerZ = tile.averageZ; // Use averageZ directly

              boundingEdges.position.set(centerX, centerY, centerZ);
              boundingBox.position.set(centerX, centerY, centerZ);

              threeScene.add(boundingEdges);
              threeScene.add(boundingBox);
            });

            // Add single mouse interaction handler for all boxes
            viewer.renderer.domElement.addEventListener(
              "mousemove",
              (event) => {
                const rect = viewer.renderer.domElement.getBoundingClientRect();
                mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

                raycaster.setFromCamera(mouse, viewer.camera);

                // Get all intersected objects
                const intersects = raycaster.intersectObjects(
                  threeScene.children.filter((child) => child.type === "Mesh")
                );

                // If we were highlighting a box, hide it
                if (currentHighlight) {
                  currentHighlight.material.visible = false;
                  currentHighlight.userData.edges.material.visible = false;
                  currentHighlight = null;
                }

                // If we found an intersection, show and highlight the new box
                if (intersects.length > 0) {
                  currentHighlight = intersects[0].object;
                  currentHighlight.material.visible = true;
                  currentHighlight.material.opacity = 0.3;
                  currentHighlight.userData.edges.material.visible = true;
                }
              }
            );

            if (viewerInstanceRef.current) {
              viewerInstanceRef.current.start();
            }
          })
          .catch((error) => {
            console.error("Error adding splat scene:", error);
          });
      });

    return () => {
      const viewer = viewerInstanceRef.current;
      if (viewer) {
        // Stop the animation loop
        if (viewer.renderLoop) {
          viewer.renderLoop.stop();
        }

        // Remove the scene
        if (viewer.splatMesh) {
          viewer.splatMesh.scene.remove(viewer.splatMesh);
        }

        // Dispose of the renderer
        if (viewer.renderer) {
          viewer.renderer.dispose();
        }

        // Use the captured ref
        if (currentViewerRef && currentViewerRef.firstChild) {
          currentViewerRef.removeChild(currentViewerRef.firstChild);
        }

        viewerInstanceRef.current = null;
      }
    };
  }, [isMounted, modelId, onProgress]);

  if (!isMounted) return null;

  return <div ref={viewerRef} style={{ width: "100%", height: "100vh" }} />;
}

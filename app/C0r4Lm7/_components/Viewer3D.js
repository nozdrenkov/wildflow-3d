import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";
import { useRouter } from "next/navigation";

export default function Viewer3D({ modelId, onProgress }) {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !viewerRef.current) return;

    const currentViewerRef = viewerRef.current;
    const threeScene = new THREE.Scene();

    const configUrl = `https://storage.googleapis.com/wildflow/${modelId}/metadata.json`;

    fetch(configUrl)
      .then((response) => response.json())
      .then((config) => {
        const camera = config.camera;
        const viewer = new GaussianSplats3D.Viewer({
          cameraUp: camera.cameraUp,
          initialCameraPosition: camera.initialCameraPosition,
          initialCameraLookAt: camera.initialCameraLookAt,
          rootElement: viewerRef.current,
          sceneRevealMode: GaussianSplats3D.SceneRevealMode.Gradual,
          crossOrigin: "anonymous",
          threeScene: threeScene,
          selfDrivenMode: true,
          useWorkers: true,
          workerConfig: {
            crossOriginIsolated: true,
          },
          dynamicScene: false,
          freeIntermediateSplatData: true,
          inMemoryCompressionLevel: 1,
          renderMode: GaussianSplats3D.RenderMode.OnChange,
          progressCallback: (percent, message) => {
            onProgress(percent, message);
          },
        });
        viewerInstanceRef.current = viewer;

        const model = config.model;
        const modelUrl = `https://storage.googleapis.com/wildflow/${modelId}/${model.filePath}`;
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
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            let currentHighlight = null;

            config.grid.tiles.forEach((tile) => {
              const geometry = new THREE.BoxGeometry(
                tile.maxX - tile.minX,
                tile.maxY - tile.minY,
                4
              );

              const edges = new THREE.EdgesGeometry(geometry);
              const edgesMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
                visible: false,
              });
              const boundingEdges = new THREE.LineSegments(
                edges,
                edgesMaterial
              );

              const boxMaterial = new THREE.MeshBasicMaterial({
                color: 0x0000ff,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthWrite: false,
                depthTest: true,
                visible: false,
              });
              const boundingBox = new THREE.Mesh(geometry, boxMaterial);

              boundingBox.userData = {
                edges: boundingEdges,
                tilePath: tile.tilePath,
                tileX: tile.tileX,
                tileY: tile.tileY,
              };

              const centerX = (tile.minX + tile.maxX) / 2;
              const centerY = (tile.minY + tile.maxY) / 2;
              const centerZ = tile.averageZ;

              boundingEdges.position.set(centerX, centerY, centerZ);
              boundingBox.position.set(centerX, centerY, centerZ);

              threeScene.add(boundingEdges);
              threeScene.add(boundingBox);
            });

            viewer.renderer.domElement.addEventListener(
              "mousemove",
              (event) => {
                const rect = viewer.renderer.domElement.getBoundingClientRect();
                mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

                raycaster.setFromCamera(mouse, viewer.camera);

                const intersects = raycaster.intersectObjects(
                  threeScene.children.filter((child) => child.type === "Mesh")
                );

                if (currentHighlight) {
                  currentHighlight.material.visible = false;
                  currentHighlight.userData.edges.material.visible = false;
                  currentHighlight = null;
                }

                if (intersects.length > 0) {
                  currentHighlight = intersects[0].object;
                  currentHighlight.material.visible = true;
                  currentHighlight.material.opacity = 0.3;
                  currentHighlight.userData.edges.material.visible = true;
                }
              }
            );

            viewer.renderer.domElement.addEventListener("dblclick", () => {
              if (currentHighlight) {
                router.push(
                  `/tile/${modelId}_${currentHighlight.userData.tileX}_${currentHighlight.userData.tileY}`
                );
              }
            });

            if (viewerInstanceRef.current) {
              viewerInstanceRef.current.start();
            }
          })
          .catch((error) => {
            console.error("Error adding splat scene:", error);
          });
      });

    return () => {
      // Stop rendering first
      const viewer = viewerInstanceRef.current;
      if (viewer) {
        // Stop any ongoing rendering
        viewer.setRenderMode(GaussianSplats3D.RenderMode.Never);

        // Stop the animation loop
        if (viewer.renderLoop) {
          viewer.renderLoop.stop();
        }

        // Remove and dispose of the splat mesh
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

        // Dispose of the renderer properly
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

      // Clean up event listeners
      if (threeScene?.userData?.cleanup) {
        threeScene.userData.cleanup();
      }

      // Dispose of all meshes, geometries, and materials in the scene
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

      // Clear the scene
      while (threeScene.children.length > 0) {
        threeScene.remove(threeScene.children[0]);
      }

      // Remove the canvas element
      if (currentViewerRef && currentViewerRef.firstChild) {
        currentViewerRef.removeChild(currentViewerRef.firstChild);
      }

      viewerInstanceRef.current = null;

      // Force garbage collection (though this is just a suggestion to the browser)
      if (window.gc) {
        window.gc();
      }
    };
  }, [isMounted, modelId, onProgress]);

  if (!isMounted) return null;

  return <div ref={viewerRef} style={{ width: "100%", height: "100vh" }}></div>;
}

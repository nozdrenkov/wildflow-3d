import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";

export default function Viewer3D({ modelId, onProgress }) {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const [message, setMessage] = useState("");
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !viewerRef.current) return;

    const currentViewerRef = viewerRef.current;
    const configUrl = `https://storage.googleapis.com/wildflow/C0r4Lm7/metadata.json?v=2`;

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
                setMessage(currentHighlight.userData.tilePath);
                setShowMessage(true);
                setTimeout(() => setShowMessage(false), 3000);
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
      const viewer = viewerInstanceRef.current;
      if (viewer) {
        if (viewer.renderLoop) {
          viewer.renderLoop.stop();
        }
        if (viewer.splatMesh) {
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
    };
  }, [isMounted, modelId, onProgress]);

  if (!isMounted) return null;

  return (
    <div ref={viewerRef} style={{ width: "100%", height: "100vh" }}>
      {showMessage && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black text-white p-4 rounded">
          {message}
        </div>
      )}
    </div>
  );
}

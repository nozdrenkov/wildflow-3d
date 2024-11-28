import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";

const _BASE_URL = "https://storage.googleapis.com/wildflow";

export default function TileViewer3D({ modelId, tileX, tileY, onProgress }) {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !viewerRef.current) return;

    const currentViewerRef = viewerRef.current;

    const configUrl = `${_BASE_URL}/${modelId}/metadata.json`;

    fetch(configUrl)
      .then((response) => response.json())
      .then((config) => {
        const tile = config.grid.tiles.find(
          (tile) => tile.tileX === tileX && tile.tileY === tileY
        );
        const tileCenterOffset = [
          -(tile.minX + tile.maxX) / 2,
          -(tile.minY + tile.maxY) / 2,
          -(tile.minZ + tile.maxZ) / 2,
        ];
        const modelUrl = `${_BASE_URL}/${modelId}/${tile.tilePath}`;
        const camera = config.camera;
        const viewer = new GaussianSplats3D.Viewer({
          cameraUp: camera.cameraUp,
          initialCameraPosition: [0, 1, 4],
          initialCameraLookAt: [0, 0, 0],
          rootElement: viewerRef.current,
          sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
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

        viewer
          .addSplatScene(modelUrl, {
            splatAlphaRemovalThreshold: 5,
            showLoadingUI: false,
            position: tileCenterOffset,
            rotation: camera.rotation || [0, 0, 0, 1],
            scale: camera.scale || [1, 1, 1],
            progressiveLoad: true,
          })
          .then(() => {
            console.log("Splat scene added successfully");
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
        if (viewer.splatMesh && viewer.splatMesh.scene) {
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

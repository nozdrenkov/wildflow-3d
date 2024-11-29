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
    const threeScene = new THREE.Scene();

    const prefix = _LOCAL_DATA
      ? `/${modelId}`
      : `https://storage.googleapis.com/wildflow/${modelId}`;
    const modelUrl = `${prefix}/splats.ksplat`;
    const cameraUrl = `${prefix}/camera.json`;

    fetch(cameraUrl)
      .then((response) => response.json())
      .then((camera) => {
        console.log(`Camera config: ${JSON.stringify(camera, null, 2)}`);
        const viewer = new GaussianSplats3D.Viewer({
          cameraUp: camera.cameraUp || [0.24929, -0.2672, -0.93084],
          initialCameraPosition: camera.initialCameraPosition || [
            -3.93951, 0.24631, -3.29199,
          ],
          initialCameraLookAt: camera.initialCameraLookAt || [
            -1.01181, 0.18365, 4.45069,
          ],
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

        viewer
          .addSplatScene(modelUrl, {
            splatAlphaRemovalThreshold: 5,
            showLoadingUI: false,
            position: camera.position || [0, 1, 0],
            rotation: camera.rotation || [0, 0, 0, 1],
            scale: camera.scale || [1.5, 1.5, 1.5],
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

      if (window.gc) {
        window.gc();
      }
    };
  }, [isMounted, modelId, onProgress]);

  if (!isMounted) return null;

  return <div ref={viewerRef} style={{ width: "100%", height: "100vh" }} />;
}

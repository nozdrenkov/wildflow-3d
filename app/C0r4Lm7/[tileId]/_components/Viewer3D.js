import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";

export default function Viewer3D({
  splatsFileUrl,
  cameraSettings,
  onProgress,
}) {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !viewerRef.current) return;

    const currentViewerRef = viewerRef.current;

    const viewer = new GaussianSplats3D.Viewer({
      cameraUp: cameraSettings.cameraUp || [0.24929, -0.2672, -0.93084],
      initialCameraPosition: cameraSettings.initialCameraPosition || [
        -3.93951, 0.24631, -3.29199,
      ],
      initialCameraLookAt: cameraSettings.initialCameraLookAt || [
        -1.01181, 0.18365, 4.45069,
      ],
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
  }, [isMounted, splatsFileUrl, onProgress]);

  if (!isMounted) return null;

  return <div ref={viewerRef} style={{ width: "100%", height: "100vh" }} />;
}
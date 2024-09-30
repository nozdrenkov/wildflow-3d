import { useEffect, useRef, useState, useCallback } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

// Add this function at the top of your file, outside of the component
function createDebuggedViewer(options) {
  console.log("Creating debugged viewer with options:", options);
  const originalProgressCallback = options.progressCallback;
  options.progressCallback = (percent, message) => {
    console.log(`GaussianSplats3D internal progress: ${percent}%, ${message}`);
    if (originalProgressCallback) {
      originalProgressCallback(percent, message);
    }
  };
  return new GaussianSplats3D.Viewer(options);
}

export default function Viewer3D({ modelId, onProgress }) {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const wireframeMeshRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    console.log("Viewer3D effect running");
    if (!isMounted || !viewerRef.current) return;

    const viewer = new GaussianSplats3D.Viewer({
      cameraUp: [0.24929, -0.2672, -0.93084],
      initialCameraPosition: [-3.93951, 0.24631, -3.29199],
      initialCameraLookAt: [-1.01181, 0.18365, 4.45069],
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
        console.log(`Viewer progressCallback: ${percent}%, ${message}`);
        onProgress(percent, message);
      },
    });

    viewerInstanceRef.current = viewer;

    console.log("Adding splat scene...");
    viewer
      .addSplatScene(`/splats.ksplat`, {
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: true,
        position: [0, 1, 0],
        rotation: [0, 0, 0, 1],
        scale: [1.5, 1.5, 1.5],
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
      console.log("Viewer3D cleanup");
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

        // Remove the canvas from the DOM
        if (viewerRef.current && viewerRef.current.firstChild) {
          viewerRef.current.removeChild(viewerRef.current.firstChild);
        }

        viewerInstanceRef.current = null;
      }
    };
  }, [isMounted, modelId, onProgress]);

  if (!isMounted) return null;

  return <div ref={viewerRef} style={{ width: "100%", height: "100vh" }} />;
}

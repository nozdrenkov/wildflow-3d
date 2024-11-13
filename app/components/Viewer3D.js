import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";
// eslint-disable-next-line
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

// Add this function at the top of your file, outside of the component
// eslint-disable-next-line
function createDebuggedViewer(options) {
  const originalProgressCallback = options.progressCallback;
  options.progressCallback = (percent, message) => {
    if (originalProgressCallback) {
      originalProgressCallback(percent, message);
    }
  };
  return new GaussianSplats3D.Viewer(options);
}

const KSPLAT_FILES = [
  "/trained_export_m7_1_8_adc_1s_0x_-3y.ksplat",
  "/trained_export_m7_1_8_adc_1s_0x_-4y.ply",
  "/trained_export_m7_1_8_adc_1s_0x_-5y.ksplat",
  "/trained_export_m7_1_8_adc_1s_0x_-6y.ksplat",
];

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

    const viewer = new GaussianSplats3D.Viewer({
      cameraUp: [0, 1, 0],
      initialCameraPosition: [0, 0, 5],
      initialCameraLookAt: [0, 0, 0],
      rootElement: viewerRef.current,
      selfDrivenMode: true,
      sharedMemoryForWorkers: false,
      dynamicScene: true,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      threeScene: new THREE.Scene(),
      useWorkers: true,
      progressCallback: (percent, message) => {
        onProgress(percent, message);
      },
    });

    viewerInstanceRef.current = viewer;

    // Load scenes sequentially with proper cleanup handling
    const loadScenes = async () => {
      try {
        for (let i = 0; i < KSPLAT_FILES.length; i++) {
          await viewer.addSplatScene(KSPLAT_FILES[i], {
            splatAlphaRemovalThreshold: 20,
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
            showLoadingUI: false,
          });
        }
        if (viewerInstanceRef.current) {
          viewerInstanceRef.current.start();
        }
      } catch (error) {
        console.error("Error loading ksplat files:", error);
      }
    };

    loadScenes();

    return () => {
      const viewer = viewerInstanceRef.current;
      if (viewer) {
        // Stop the animation loop
        if (viewer.renderLoop) {
          viewer.renderLoop.stop();
        }

        // Remove the scene
        if (viewer.splatMesh) {
          viewer.splatMesh.disposeSplatTree();
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

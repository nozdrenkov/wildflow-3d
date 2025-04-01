import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

const _LOCAL_DATA = true;

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

    const splatModelUrl = `/m9/cell-2x-2y5s.ksplat`;
    const pointCloudModelUrl = `/m9/point_cloud.ply`;

    // Camera parameters from comments
    const camera = {
      position: [-6.36302, -7.56634, 1.84438],
      lookAt: [-7.69713, -7.04284, -3.20002],
      up: [0.0, 1.0, 0.0],
      scale: [1.0, 1.0, 1.0],
      rotation: [0, 0, 0, 1],
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

    // Load point cloud first
    const loader = new PLYLoader();
    loader.load(pointCloudModelUrl, (geometry) => {
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

      // Initialize viewer with settings from working implementation
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
        .addSplatScene(splatModelUrl, {
          splatAlphaRemovalThreshold: 5,
          showLoadingUI: false,
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          scale: [1, 1, 1],
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

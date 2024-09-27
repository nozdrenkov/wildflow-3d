import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";
import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

export default function Viewer3D() {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const wireframeMeshRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || !viewerRef.current) return;

    const threeScene = new THREE.Scene();
    const modelUrl = "/splats.ksplat";

    const viewer = new GaussianSplats3D.Viewer({
      cameraUp: [0.24929, -0.2672, -0.93084],
      initialCameraPosition: [-3.93951, 0.24631, -3.29199],
      initialCameraLookAt: [-1.01181, 0.18365, 4.45069],
      rootElement: viewerRef.current,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Gradual,
      crossOrigin: "anonymous",
      threeScene: threeScene,
      selfDrivenMode: true,
      useWorkers: true,
      workerConfig: {
        crossOriginIsolated: true,
      },
    });

    viewerInstanceRef.current = viewer;

    const plyLoader = new PLYLoader();
    plyLoader.load("/model_full.ply", (geometry) => {
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
      const wireframeMesh = new THREE.LineSegments(
        new THREE.WireframeGeometry(geometry),
        lineMaterial
      );

      geometry.computeBoundingBox();
      const meshCenter = new THREE.Vector3();
      geometry.boundingBox.getCenter(meshCenter);

      wireframeMesh.position.sub(meshCenter);

      const meshGroup = new THREE.Group();
      meshGroup.add(wireframeMesh);
      meshGroup.position.set(0.44, 0.04, -10.85);

      threeScene.add(meshGroup);
      wireframeMeshRef.current = wireframeMesh;
    });

    viewer
      .addSplatScene(modelUrl, {
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: true,
        position: [0, 1, 0],
        rotation: [0, 0, 0, 1],
        scale: [1.5, 1.5, 1.5],
        progressiveLoad: true,
      })
      .then(() => {
        if (viewerInstanceRef.current) {
          viewerInstanceRef.current.start();
        }
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
          threeScene.remove(viewer.splatMesh);
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
  }, [isMounted]);

  if (!isMounted) return null;

  return <div ref={viewerRef} style={{ width: "100%", height: "100vh" }} />;
}

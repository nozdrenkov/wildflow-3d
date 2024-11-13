import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";

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
    const scene = new THREE.Scene();

    const viewer = new GaussianSplats3D.Viewer({
      cameraUp: [0, 1, 0],
      initialCameraPosition: [0, 0, 5],
      initialCameraLookAt: [0, 0, 0],
      rootElement: viewerRef.current,
      selfDrivenMode: true,
      sharedMemoryForWorkers: false,
      dynamicScene: true,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      threeScene: scene,
      useWorkers: true,
      progressCallback: (percent, message) => {
        onProgress(percent, message);
      },
    });

    viewerInstanceRef.current = viewer;

    const loadScenes = async () => {
      try {
        const response = await fetch(`/${modelId}.json`);
        const modelData = await response.json();

        for (const patch of modelData.patches) {
          const baseFileName = patch.patch.replace(".ply", "");
          const gridStep = patch.grid_step;
          const averageZ = patch.average_z;

          const sphereGeometry = new THREE.SphereGeometry(gridStep / 6, 32, 32);
          const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x0000ff,
          });

          for (const [cellX, cellY] of patch.cells) {
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

            sphere.position.set(
              cellX + gridStep / 2,
              cellY + gridStep / 2,
              averageZ
            );

            scene.add(sphere);
          }

          for (const [cellX, cellY] of patch.cells) {
            const filePath = `grid-${gridStep}/${baseFileName}_${gridStep}s_${cellX}x_${cellY}y.ply`;
            await viewer.addSplatScene(filePath, {
              splatAlphaRemovalThreshold: 20,
              position: [0, 0, 0],
              rotation: [0, 0, 0, 1],
              scale: [1, 1, 1],
              showLoadingUI: false,
            });
          }
        }

        if (viewerInstanceRef.current) {
          viewerInstanceRef.current.start();
        }
      } catch (error) {
        console.error("Error loading scene files:", error);
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

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
    };
  }, [isMounted, modelId, onProgress]);

  if (!isMounted) return null;

  return <div ref={viewerRef} style={{ width: "100%", height: "100vh" }} />;
}

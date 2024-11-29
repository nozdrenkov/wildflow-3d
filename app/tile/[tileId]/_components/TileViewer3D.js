import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";
import { useRouter } from "next/navigation";

const _BASE_URL = "https://storage.googleapis.com/wildflow";

export default function TileViewer3D({ modelId, tileX, tileY, onProgress }) {
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

        var neighbourDirections = [];
        for (const [dx, dy] of [
          [0, +1],
          [-1, 0],
          [0, -1],
          [+1, 0],
        ]) {
          const nx = tileX + dx;
          const ny = tileY + dy;
          const neighbourTile = config.grid.tiles.find(
            (tile) => tile.tileX === nx && tile.tileY === ny
          );
          if (neighbourTile) {
            neighbourDirections.push([dx, dy]);
          }
        }

        for (const [dx, dy] of neighbourDirections) {
          const averageZ = tile.averageZ + tileCenterOffset[2];
          // Define the vertices of the triangle
          const vertices = new Float32Array([
            dx * 3.5 - dy,
            dy * 3.5 - dx,
            averageZ,
            dx * 4.5,
            dy * 4.5,
            averageZ,
            dx * 3.5 + dy,
            dy * 3.5 + dx,
            averageZ,
          ]);

          // Create a buffer geometry
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(vertices, 3)
          );

          // Create a material for the triangle
          const material = new THREE.MeshBasicMaterial({
            color: 0x0000ff,
            side: THREE.DoubleSide,
          });

          // Create a mesh with the geometry and material
          const triangle = new THREE.Mesh(geometry, material);
          threeScene.add(triangle);

          // Raycaster and mouse vector for detecting hover
          const raycaster = new THREE.Raycaster();
          const mouse = new THREE.Vector2();

          // Event listener for mouse movement
          const onMouseMove = (event) => {
            // Calculate mouse position in normalized device coordinates
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            // Update the raycaster with the camera and mouse position
            raycaster.setFromCamera(mouse, viewer.camera);

            // Check for intersections with the triangle
            const intersects = raycaster.intersectObject(triangle);

            // Change color based on intersection
            if (intersects.length > 0) {
              triangle.material.color.set(0x00ff00); // Green
            } else {
              triangle.material.color.set(0x0000ff); // Blue
            }
          };

          // Event listener for mouse click
          const onClick = (event) => {
            // Calculate mouse position in normalized device coordinates
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            // Update the raycaster with the camera and mouse position
            raycaster.setFromCamera(mouse, viewer.camera);

            // Check for intersections with the triangle
            const intersects = raycaster.intersectObject(triangle);

            const nx = tileX + dx;
            const ny = tileY + dy;
            if (intersects.length > 0) {
              router.push(`/tile/${modelId}_${nx}_${ny}`);
            }
          };

          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("click", onClick);

          // Add cleanup for this specific triangle's listeners
          threeScene.userData.cleanup = () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("click", onClick);
          };
        }

        // Initialize the GaussianSplats3D viewer with the custom scene
        const viewer = new GaussianSplats3D.Viewer({
          cameraUp: camera.cameraUp,
          initialCameraPosition: [0, 1, 4],
          initialCameraLookAt: [0, 0, 0],
          rootElement: viewerRef.current,
          sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
          crossOrigin: "anonymous",
          threeScene: threeScene, // Use the custom scene
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
      // Call the cleanup function if it exists
      if (threeScene?.userData?.cleanup) {
        threeScene.userData.cleanup();
      }

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

import { useEffect, useRef, useState } from "react";
import * as GaussianSplats3D from "gaussian-splats-3d";
import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { WorldPositionedSpinner } from "./Spinner";
import { getDeviceType } from "../../utils/deviceDetect";

const _BLUE = 0x0000ff;
const _ORANGE = 0xff8800;

const _SCENE_BOUNDS = {
  minX: -20.0,
  maxX: 18.0,
  minY: -19.0,
  maxY: 20.0,
};
const _DEFAULT_Z = -4.0;

const _POINT_SIZE = 0.03;
const _POINT_TEXTURE_SIZE = 64;

const _DEFAULT_CAMERA = {
  position: [1.77682, -2.34684, -2.54636],
  lookAt: [1.47297, -0.71896, -5.57604],
  up: [-0.04675, 0.93622, 0.34828],
};

export default function Viewer3D({ onProgress }) {
  const deviceInfo = getDeviceType();
  const _MODEL_PATH = "https://storage.googleapis.com/wildflow/T4bUHn";
  // const _MODEL_PATH = "/T4bUHn";
  const _POINT_CLOUD_PATH = `${_MODEL_PATH}/pc.ply`;
  const _SPLAT_FOLDER = `${_MODEL_PATH}/splats`;
  // [[6,14],[3,-1],[-3,4],[-2,4]] -- just a JSON like that
  // [-3,4] would become "-3x4y1s" etc.
  const _CELLS_PATH = `${_MODEL_PATH}/cells.json`;

  const [selectionBoxSize, setSelectionBoxSize] = useState(
    deviceInfo.isLowEndDevice
      ? {
          xSize: 4,
          ySize: 4,
        }
      : {
          xSize: 6,
          ySize: 5,
        }
  );

  const valueBetween = (x, minX, maxX, margin) => {
    let mnX = minX + margin;
    let mxX = maxX - margin;
    if (mnX > mxX) {
      throw new Error(
        "minX is greater than maxX. " +
          "Selection box can't be bigger than the whole field."
      );
    }
    if (x < mnX) return mnX;
    if (x > mxX) return mxX;
    return x;
  };

  const selectionBoxCenter = (x, y) => {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    return {
      x: valueBetween(
        cellX + (selectionBoxSize.xSize % 2) / 2,
        _SCENE_BOUNDS.minX,
        _SCENE_BOUNDS.maxX,
        selectionBoxSize.xSize / 2
      ),
      y: valueBetween(
        cellY + (selectionBoxSize.ySize % 2) / 2,
        _SCENE_BOUNDS.minY,
        _SCENE_BOUNDS.maxY,
        selectionBoxSize.ySize / 2
      ),
    };
  };

  const _INIT_BOX = selectionBoxCenter(
    _DEFAULT_CAMERA.lookAt[0],
    _DEFAULT_CAMERA.lookAt[1]
  );

  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const selectionBoxRef = useRef(null);
  const currentSelectionBoxRef = useRef(null);
  const loadedSplatIdsRef = useRef(new Set());
  const isLoadingRef = useRef(false);
  const [isMounted, setIsMounted] = useState(false);
  const [availableCells, setAvailableCells] = useState(null);
  const [spinnerPosition, setSpinnerPosition] = useState({
    visible: false,
    worldPos: null,
  });

  // Load available cells from JSON file
  useEffect(() => {
    if (isMounted) {
      fetch(_CELLS_PATH)
        .then((response) => {
          if (!response.ok) {
            console.warn(
              "Failed to load cells.json, will check each file individually"
            );
            setAvailableCells(new Set());
            return [];
          }
          return response.json();
        })
        .then((cellsData) => {
          // Convert the array of coordinates to a Set of cell IDs for fast lookup
          const cellsSet = new Set();
          if (Array.isArray(cellsData)) {
            cellsData.forEach(([x, y]) => {
              const cellId = `${x}x${y}y1s`;
              cellsSet.add(cellId);
            });
          }
          setAvailableCells(cellsSet);
          console.log(`Loaded ${cellsSet.size} available cells`);
        })
        .catch((error) => {
          console.error("Error loading cells.json:", error);
          setAvailableCells(new Set());
        });
    }
  }, [isMounted, _CELLS_PATH]);

  useEffect(() => {
    const updateSelectionBoxFromURL = () => {
      let sizeFound = false;

      // Client-side parsing of the URL for the @NxN pattern
      const pathname = window.location.pathname;
      const atMatch = pathname.match(/@(\d+)x(\d+)$/);

      if (atMatch) {
        const xSize = parseInt(atMatch[1], 10);
        const ySize = parseInt(atMatch[2], 10);

        // Validate size
        const validXSize = Math.max(1, Math.min(xSize, 10));
        const validYSize = Math.max(1, Math.min(ySize, 10));

        setSelectionBoxSize({
          xSize: validXSize,
          ySize: validYSize,
        });
        sizeFound = true;
      }

      // If the @ pattern wasn't found, check query params
      if (!sizeFound) {
        const params = new URLSearchParams(window.location.search);
        const sizeParam = params.get("size");

        if (sizeParam) {
          const sizeMatch = sizeParam.match(/^(\d+)x(\d+)$/);
          if (sizeMatch) {
            const xSize = parseInt(sizeMatch[1], 10);
            const ySize = parseInt(sizeMatch[2], 10);

            // Validate size
            const validXSize = Math.max(1, Math.min(xSize, 10));
            const validYSize = Math.max(1, Math.min(ySize, 10));

            setSelectionBoxSize({
              xSize: validXSize,
              ySize: validYSize,
            });
          }
        }
      }
    };

    // Initial update
    updateSelectionBoxFromURL();

    // Listen for URL changes
    window.addEventListener("popstate", updateSelectionBoxFromURL);

    setIsMounted(true);

    return () => {
      window.removeEventListener("popstate", updateSelectionBoxFromURL);
    };
  }, []);

  useEffect(() => {
    if (!isMounted || !viewerRef.current) return;

    const threeScene = new THREE.Scene();
    let cleanup;

    async function init() {
      // Create viewer and initialize scene
      const viewer = createViewer(threeScene);
      viewerInstanceRef.current = viewer;

      // Create bounding box
      createSelectionBox(threeScene);

      // Set up event handlers
      setupEventHandlers(viewer);

      // Load point cloud and initial splats
      loadPointCloud(threeScene, viewer);

      // Prepare cleanup function
      cleanup = () => cleanupResources(viewer, threeScene);
    }

    init();

    return () => cleanup && cleanup();
  }, [isMounted, onProgress]);

  function createViewer(threeScene) {
    const viewer = new GaussianSplats3D.Viewer({
      cameraUp: _DEFAULT_CAMERA.up,
      initialCameraPosition: _DEFAULT_CAMERA.position,
      initialCameraLookAt: _DEFAULT_CAMERA.lookAt,
      rootElement: viewerRef.current,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      crossOrigin: "anonymous",
      threeScene: threeScene,
      selfDrivenMode: true,
      useWorkers: true,
      workerConfig: { crossOriginIsolated: true },
      dynamicScene: true,
      freeIntermediateSplatData: false,
      inMemoryCompressionLevel: 0,
      renderMode: GaussianSplats3D.RenderMode.Always,
      controlsEnabled: true,
      disableControlsDuringLoading: false,
      controlOptions: {
        autoRotate: false,
        enableDamping: true,
        dampingFactor: 0.05,
      },
      progressCallback: (percent, message) => {
        onProgress(percent, message);
      },
    });

    viewer.start();

    // Add a force render method to the viewer for immediate visual updates
    viewer.forceRender = function () {
      if (this.renderer && this.camera && this.threeScene) {
        // Update controls before rendering
        if (this.controls) this.controls.update();
        this.renderer.render(this.threeScene, this.camera);
      } else if (this.renderer && this.camera) {
        if (this.controls) this.controls.update();
        this.renderer.render(threeScene, this.camera);
      }
    };

    // Set up an animation loop to keep controls responsive during loading
    const animateControls = () => {
      if (viewer.controls && viewer.renderer && viewer.camera) {
        viewer.controls.update();
        // Only render if we're in loading state to avoid duplicate renders
        if (isLoadingRef.current) {
          viewer.renderer.render(
            viewer.threeScene || threeScene,
            viewer.camera
          );
        }
      }
      viewer._controlsAnimationId = requestAnimationFrame(animateControls);
    };

    // Start the animation loop
    animateControls();

    // Ensure controls are always enabled
    if (viewer.controls) {
      viewer.controls.enabled = true;
    }

    return viewer;
  }

  function createCircleTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = _POINT_TEXTURE_SIZE;
    canvas.height = _POINT_TEXTURE_SIZE;
    const context = canvas.getContext("2d");
    const radius = _POINT_TEXTURE_SIZE / 2 - 2;

    context.beginPath();
    context.arc(
      _POINT_TEXTURE_SIZE / 2,
      _POINT_TEXTURE_SIZE / 2,
      radius,
      0,
      2 * Math.PI
    );
    context.fillStyle = "white";
    context.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function createSelectionBox(threeScene) {
    if (selectionBoxRef.current && selectionBoxRef.current.parent) {
      threeScene.remove(selectionBoxRef.current);
    }

    const planeMaterial = new THREE.MeshBasicMaterial({
      color: _ORANGE,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      visible: true,
    });

    const planeGeometry = new THREE.PlaneGeometry(
      selectionBoxSize.xSize,
      selectionBoxSize.ySize
    );
    const selectionBox = new THREE.Mesh(planeGeometry, planeMaterial);
    selectionBox.position.set(_INIT_BOX.x, _INIT_BOX.y, _DEFAULT_Z);
    selectionBox.rotation.x = 0;
    threeScene.add(selectionBox);
    selectionBoxRef.current = selectionBox;
    currentSelectionBoxRef.current = _INIT_BOX;
  }

  function getMouseIntersection(event, viewer) {
    if (!viewer || !viewer.camera) return null;

    // Calculate mouse position in normalized device coordinates
    const rect = viewer.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Set up raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, viewer.camera);
    const ray = raycaster.ray;

    // Find intersection with horizontal plane at _DEFAULT_Z
    const planeZ = _DEFAULT_Z;
    const t = (planeZ - ray.origin.z) / ray.direction.z;

    if (t <= 0) return null; // No intersection

    // Calculate intersection point
    const point = new THREE.Vector3()
      .copy(ray.origin)
      .addScaledVector(ray.direction, t);
    return { x: point.x, y: point.y };
  }

  const isPointInBox = (x, y, boxX, boxY) => {
    const halfBoxSizeX = selectionBoxSize.xSize / 2;
    const halfBoxSizeY = selectionBoxSize.ySize / 2;
    return (
      x >= boxX - halfBoxSizeX &&
      x <= boxX + halfBoxSizeX &&
      y >= boxY - halfBoxSizeY &&
      y <= boxY + halfBoxSizeY
    );
  };

  function handleMouseMove(event, viewer) {
    const intersection = getMouseIntersection(event, viewer);
    if (!intersection) return;
    const { x, y } = intersection;

    // Only update and show the bounding box if we're not in loading state
    if (!isLoadingRef.current) {
      const boxCenter = selectionBoxCenter(x, y);
      selectionBoxRef.current.position.x = boxCenter.x;
      selectionBoxRef.current.position.y = boxCenter.y;
      const loadedBox = currentSelectionBoxRef.current;
      const isInLoadedBox =
        loadedBox && isPointInBox(x, y, loadedBox.x, loadedBox.y);
      if (selectionBoxRef.current) {
        selectionBoxRef.current.visible = !isInLoadedBox;
      }
    }
    // We're not returning here, so the event continues to propagate
    // to the camera controls, allowing navigation even during loading
  }

  function handleDoubleClick(event, viewer) {
    const intersection = getMouseIntersection(event, viewer);
    if (!intersection) return;
    const { x, y } = intersection;

    // If we loading splats, don't do anything
    if (isLoadingRef.current) return;

    // Don't do anything if the cursor inside splat area
    const loadedBox = currentSelectionBoxRef.current;
    const isInLoadedBox =
      loadedBox && isPointInBox(x, y, loadedBox.x, loadedBox.y);
    if (isInLoadedBox) return;

    onProgress(5, "Processing double-click...");
    isLoadingRef.current = true;

    const boxCenter = selectionBoxCenter(x, y);
    selectionBoxRef.current.position.x = boxCenter.x;
    selectionBoxRef.current.position.y = boxCenter.y;
    currentSelectionBoxRef.current = boxCenter;

    loadSplatsForGrid().catch((error) => {
      console.error("Error in loadSplatsForGrid:", error);
      selectionBoxRef.current.material.color.set(_BLUE); // Reset to blue on error
      isLoadingRef.current = false;
      onProgress(0, "");
    });
  }

  function showSpinner(position) {
    if (!position) return;

    // Position spinner slightly above the plane
    setSpinnerPosition({
      visible: true,
      worldPos: new THREE.Vector3(
        position.x,
        position.y,
        _DEFAULT_Z + 0.1 // Just slightly above the plane
      ),
    });
  }

  function hideSpinner() {
    setSpinnerPosition((prev) => ({ ...prev, visible: false }));
  }

  const getRange = (centerCoord, length) => {
    const start = Math.floor(centerCoord) - Math.floor(length / 2);
    const end = start + length;
    return [start, end];
  };

  const boxToCellIds = (boxCenterX, boxCenterY) => {
    const [startX, endX] = getRange(boxCenterX, selectionBoxSize.xSize);
    const [startY, endY] = getRange(boxCenterY, selectionBoxSize.ySize);
    const cellsToLoad = [];
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        cellsToLoad.push(`${x}x${y}y1s`);
      }
    }
    return cellsToLoad;
  };

  async function loadSplatsForGrid() {
    try {
      isLoadingRef.current = true;
      onProgress(35, "Preparing to load splats...");

      selectionBoxRef.current.material.color.set(_ORANGE); // Set to orange for loading
      selectionBoxRef.current.visible = true;
      showSpinner({
        x: currentSelectionBoxRef.current.x,
        y: currentSelectionBoxRef.current.y,
        z: _DEFAULT_Z,
      });

      const cellsToLoad = boxToCellIds(
        currentSelectionBoxRef.current.x,
        currentSelectionBoxRef.current.y
      );

      // If we don't have the cells list yet, wait for it with a timeout
      if (availableCells === null) {
        onProgress(38, "Loading list of available cells...");

        let cellsLoaded = false;
        const waitForCells = new Promise((resolve) => {
          const checkAvailable = () => {
            if (availableCells !== null) {
              cellsLoaded = true;
              resolve();
            } else {
              setTimeout(checkAvailable, 100);
            }
          };
          checkAvailable();
        });

        // Add timeout to prevent infinite waiting
        const timeout = new Promise((resolve) => {
          setTimeout(() => {
            if (!cellsLoaded) {
              console.warn(
                "Timeout waiting for cells.json, proceeding without it"
              );
              setAvailableCells(new Set()); // Set to empty set to avoid further waiting
            }
            resolve();
          }, 3000);
        });

        await Promise.race([waitForCells, timeout]);
      }

      const viewer = viewerInstanceRef.current;
      if (viewer && viewer.controls) {
        viewer.controls.enabled = true;
      }
      if (viewer && viewer.forceRender) {
        viewer.forceRender();
      }

      onProgress(40, "Clearing previous splats...");
      await clearExistingSplats(viewer);

      // Add this defensive check - we might have no valid cells to load
      if (availableCells && availableCells.size === 0) {
        console.log("No available cells to load, skipping download");
        onProgress(90, "No available cells found");
        setTimeout(() => {
          onProgress(100, "Loading complete");
          hideSpinner();
          selectionBoxRef.current.material.color.set(_BLUE);
          setTimeout(() => onProgress(0, ""), 1500);
          isLoadingRef.current = false;
        }, 500);
        return;
      }

      onProgress(50, "Downloading splat files...");
      const { splatBuffers, splatConfigs } = await downloadSplatFiles(
        viewer,
        cellsToLoad
      );

      onProgress(90, "Preparing to display splats...");
      await addSplatsToScene(viewer, splatBuffers, splatConfigs);

      onProgress(100, "Loading complete");
      hideSpinner();
      selectionBoxRef.current.material.color.set(_BLUE);

      setTimeout(() => onProgress(0, ""), 1500);
    } catch (error) {
      console.error("Error loading splats:", error);
      onProgress(100, "Error loading splats");
      setTimeout(() => onProgress(0, ""), 2000);

      hideSpinner();
      isLoadingRef.current = false;
    }
  }

  async function clearExistingSplats(viewer) {
    try {
      if (viewer.splatMesh?.disposeSplatTree) {
        viewer.splatMesh.disposeSplatTree();
      }

      if (viewer.reset) {
        await viewer.reset();
      } else if (viewer.getSceneCount && viewer.removeSplatScenes) {
        const sceneCount = viewer.getSceneCount();
        if (sceneCount > 0) {
          const scenesToRemove = Array.from(
            { length: sceneCount },
            (_, i) => i
          );
          await viewer.removeSplatScenes(scenesToRemove, false);
        }
      }

      loadedSplatIdsRef.current.clear();
    } catch (e) {
      console.error("Error clearing existing content:", e);
    }
  }

  async function downloadSplatFiles(viewer, cellsToLoad) {
    const splatBuffers = [];
    const splatConfigs = [];
    const totalFiles = cellsToLoad.length;
    let filesLoaded = 0;
    let filesAttempted = 0;

    // Filter cells based on available cells list
    const cellsToAttempt = availableCells
      ? cellsToLoad.filter((cellId) => availableCells.has(cellId))
      : cellsToLoad;

    console.log(
      `Attempting to load ${cellsToAttempt.length} of ${cellsToLoad.length} cells`
    );

    // Force a render before starting downloads to ensure UI is updated
    if (viewer.forceRender) {
      viewer.forceRender();
    }

    // Process files in batches to allow UI updates between downloads
    const batchSize = 5;
    for (let i = 0; i < cellsToAttempt.length; i += batchSize) {
      const batch = cellsToAttempt.slice(i, i + batchSize);

      // Process this batch in parallel
      await Promise.all(
        batch.map(async (cellId) => {
          // The filepath needs to be .ksplat instead of .ply
          const filePath = `${_SPLAT_FOLDER}/${cellId}.ksplat`;
          filesAttempted++;

          try {
            // Directly try to download the file and handle errors gracefully
            const buffer = await safeDownloadSplatBuffer(
              viewer,
              filePath,
              GaussianSplats3D.SceneFormat.KSplat
            );

            if (buffer) {
              splatBuffers.push(buffer);
              splatConfigs.push({
                position: [0, 0, 0],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1],
                splatAlphaRemovalThreshold: 5,
              });
              loadedSplatIdsRef.current.add(cellId);
              filesLoaded++;
            } else {
              console.log(`No buffer returned for: ${filePath}`);
            }

            // Update progress for both successful and failed downloads
            onProgress(
              50 + Math.round((filesAttempted / totalFiles) * 50),
              `Downloaded ${filesLoaded}/${filesAttempted} files`
            );
          } catch (error) {
            console.error(`Error downloading cell ${cellId}:`, error);
            // Update progress even for failed files
            onProgress(
              50 + Math.round((filesAttempted / totalFiles) * 50),
              `Downloaded ${filesLoaded}/${filesAttempted} files`
            );
          }
        })
      );

      // Give the main thread some time to breathe between batches
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Force a render to keep the UI responsive
      if (viewer.forceRender) {
        viewer.forceRender();
      }
    }

    return { splatBuffers, splatConfigs };
  }

  // Helper function to safely download a splat buffer with better error handling
  async function safeDownloadSplatBuffer(viewer, filePath, format) {
    try {
      if (!viewer || !viewer.downloadSplatSceneToSplatBuffer) {
        console.error("Viewer or download method not available");
        return null;
      }

      // Wrap the downloadSplatSceneToSplatBuffer in our own fetch to handle 404s better
      // This gives us more control over the error handling
      const response = await fetch(filePath);
      if (!response.ok) {
        console.log(
          `File not found or error: ${filePath} (${response.status})`
        );
        return null;
      }

      // If the response is OK, proceed with the actual download
      return await viewer.downloadSplatSceneToSplatBuffer(
        filePath,
        5, // splatAlphaRemovalThreshold
        undefined,
        false, // showLoadingUI
        undefined,
        format
      );
    } catch (error) {
      // Much more comprehensive error detection
      const errorMessage = error.message || "";
      if (
        errorMessage.includes("404") ||
        errorMessage.includes("Not Found") ||
        errorMessage.includes("failed") ||
        errorMessage.includes("Fetch") ||
        errorMessage.includes("<!DOCTYPE html>") // HTML error responses
      ) {
        console.log(`Error loading file (likely 404): ${filePath}`);
        console.log("Error details:", errorMessage.substring(0, 100) + "...");
        return null;
      }
      // Re-throw other errors
      console.error("Unknown error in safeDownloadSplatBuffer:", error);
      throw error;
    }
  }

  async function addSplatsToScene(viewer, splatBuffers, splatConfigs) {
    // Add a slight delay to ensure UI updates
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      // Ensure controls remain enabled
      if (viewer && viewer.controls) {
        viewer.controls.enabled = true;
      }

      // Filter out null buffers
      const validBuffers = splatBuffers.filter((b) => b !== null);
      const validConfigs = splatConfigs.slice(0, validBuffers.length);

      // Only proceed if we have valid buffers
      if (validBuffers.length > 0) {
        if (typeof viewer.addSplatBuffers === "function") {
          onProgress(95, "Adding splats to scene...");

          await viewer.addSplatBuffers(
            validBuffers,
            validConfigs,
            true, // finalBuild
            false, // showLoadingUI
            false, // showLoadingUIForSplatTreeBuild
            false, // replaceExisting
            true, // enableRenderBeforeFirstSort
            true // preserveVisibleRegion
          );
        } else {
          // Fallback method
          console.log("Using fallback: Adding splat scenes sequentially");

          // Disable rendering temporarily
          const originalRenderMode = viewer.renderMode;
          viewer.setRenderMode(GaussianSplats3D.RenderMode.Never);

          // Add scenes without rendering between
          for (const config of splatConfigs) {
            if (config.path) {
              await viewer.addSplatScene(config.path, config);
            }
          }

          // Re-enable rendering
          viewer.setRenderMode(originalRenderMode);
        }
      } else {
        console.log("No valid splat buffers found to add to scene");
      }

      // Hide the bounding box after splats are loaded
      if (selectionBoxRef.current) {
        selectionBoxRef.current.visible = false;
        // Reset color back to blue for next use
        selectionBoxRef.current.material.color.set(_BLUE);
      }

      // Hide the spinner
      hideSpinner();

      // Reset loading state to allow mouse movement to affect box again
      isLoadingRef.current = false;
    } catch (error) {
      console.error("Error adding splats to scene:", error);
      // Reset color back to blue if there's an error
      if (selectionBoxRef.current) {
        selectionBoxRef.current.material.color.set(_BLUE);
      }
      // Make sure to reset loading state
      isLoadingRef.current = false;

      // Hide the spinner on error
      hideSpinner();

      throw error;
    }
  }

  function loadPointCloud(threeScene, viewer) {
    const loader = new PLYLoader();

    isLoadingRef.current = true;

    onProgress(5, "Loading point cloud...");

    loader.load(
      _POINT_CLOUD_PATH,
      (geometry) => {
        const material = new THREE.PointsMaterial({
          size: _POINT_SIZE,
          vertexColors: true,
          sizeAttenuation: true,
          alphaTest: 0.5,
          transparent: true,
          depthWrite: false,
          map: createCircleTexture(),
        });
        const pointCloud = new THREE.Points(geometry, material);
        threeScene.add(pointCloud);

        viewer.forceRender();

        setTimeout(() => {
          onProgress(35, "Point cloud loaded, loading splats...");
          loadSplatsForGrid();
        }, 500); // Small delay to ensure the point cloud renders
      },
      (xhr) => {
        const percentComplete = (xhr.loaded / xhr.total) * 100;
        onProgress(Math.round(percentComplete * 0.3), "Loading point cloud...");
      },
      (error) => {
        console.error("Error loading point cloud:", error);
        onProgress(30, "Point cloud failed...");
      }
    );
  }

  function cleanupResources(viewer, threeScene) {
    // Clean up viewer
    if (viewer) {
      viewer.setRenderMode(GaussianSplats3D.RenderMode.Never);

      if (viewer.renderLoop) {
        viewer.renderLoop.stop();
      }

      // Cancel our controls animation loop
      if (viewer._controlsAnimationId) {
        cancelAnimationFrame(viewer._controlsAnimationId);
      }

      if (viewer.splatMesh) {
        if (viewer.splatMesh.geometry) viewer.splatMesh.geometry.dispose();
        if (viewer.splatMesh.material) viewer.splatMesh.material.dispose();
        if (viewer.splatMesh.parent)
          viewer.splatMesh.parent.remove(viewer.splatMesh);
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

    // Clean up THREE scene
    if (threeScene) {
      if (threeScene.userData?.cleanup) {
        threeScene.userData.cleanup();
      }

      threeScene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
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
    }

    // Clean up DOM elements
    if (viewerRef.current?.firstChild) {
      viewerRef.current.removeChild(viewerRef.current.firstChild);
    }

    // Clear refs
    viewerInstanceRef.current = null;
    selectionBoxRef.current = null;
    loadedSplatIdsRef.current.clear();

    // Force garbage collection if available
    if (window.gc) window.gc();

    // Hide spinner when cleaning up
    hideSpinner();
  }

  function setupEventHandlers(viewer) {
    // Handle mouse move
    viewer.renderer.domElement.addEventListener("mousemove", (event) => {
      // We need to allow navigation even during loading,
      // but only block the bounding box updates
      handleMouseMove(event, viewer);
    });

    // Handle double-click
    viewer.renderer.domElement.addEventListener("dblclick", (event) => {
      // Only handle double-click if not already loading
      if (!isLoadingRef.current) {
        handleDoubleClick(event, viewer);
      }
    });
  }

  if (!isMounted) return null;

  return (
    <>
      <div ref={viewerRef} style={{ width: "100%", height: "100vh" }} />
      {spinnerPosition.visible && viewerInstanceRef.current && (
        <WorldPositionedSpinner
          visible={spinnerPosition.visible}
          worldPos={spinnerPosition.worldPos}
          camera={viewerInstanceRef.current.camera}
          renderer={viewerInstanceRef.current.renderer}
        />
      )}
    </>
  );
}

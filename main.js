import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";
import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

const pathSegments = window.location.pathname.split("/").filter(Boolean);
const modelId = pathSegments[0] || "W32Em7";
const modelUrl = "/splats.ksplat";

const threeScene = new THREE.Scene();
let wireframeMesh;
let meshCenter;

const plyLoader = new PLYLoader();
plyLoader.load("/selected_colony_x85.ply", (geometry) => {
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
  wireframeMesh = new THREE.LineSegments(
    new THREE.WireframeGeometry(geometry),
    lineMaterial
  );

  // Calculate the center of the bounding box
  geometry.computeBoundingBox();
  meshCenter = new THREE.Vector3();
  geometry.boundingBox.getCenter(meshCenter);

  // Adjust the mesh position so that its center is at the origin
  wireframeMesh.position.sub(meshCenter);

  // Create a group to hold the mesh
  const meshGroup = new THREE.Group();
  meshGroup.add(wireframeMesh);

  // Position the group at the original position
  meshGroup.position.set(0.44, 0.04, -10.85);

  threeScene.add(meshGroup);
});

const viewer = new GaussianSplats3D.Viewer({
  cameraUp: [0.24929, -0.2672, -0.93084],
  initialCameraPosition: [-3.93951, 0.24631, -3.29199],
  initialCameraLookAt: [-1.01181, 0.18365, 4.45069],
  rootElement: document.getElementById("viewer"),
  sceneRevealMode: GaussianSplats3D.SceneRevealMode.Gradual,
  crossOrigin: "anonymous",
  threeScene: threeScene,
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
    viewer.start();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("sliders") !== null) {
      createSliders();
    }
  });

function createSliders() {
  const container = document.createElement("div");
  container.className =
    "absolute top-2 left-2 right-2 bg-black bg-opacity-50 p-4 rounded";

  const params = [
    { name: "x", default: 0.44, min: -20, max: 50 },
    { name: "y", default: 0.04, min: -20, max: 50 },
    { name: "z", default: -10.85, min: -20, max: 50 },
    { name: "rotX", default: -0.31, min: -180, max: 180 },
    { name: "rotY", default: -0.01, min: -180, max: 180 },
    { name: "rotZ", default: -46.33, min: -180, max: 180 },
    { name: "scale", default: 0.42, min: -100, max: 100 },
  ];

  params.forEach((param) => {
    const label = document.createElement("label");
    label.className = "flex items-center mb-2";
    label.innerHTML = `<span class="text-white mr-2 w-10">${param.name}:</span>`;

    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.001";
    input.value = param.default;
    input.className = "w-20 mr-2 px-2 py-1 text-black bg-white rounded";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = param.min;
    slider.max = param.max;
    slider.step = "0.001";
    slider.value = param.default;
    slider.className = "flex-grow";

    input.addEventListener("input", () => {
      slider.value = input.value;
      updateMesh();
    });

    slider.addEventListener("input", () => {
      input.value = slider.value;
      updateMesh();
    });

    label.appendChild(input);
    label.appendChild(slider);
    container.appendChild(label);
  });

  document.body.appendChild(container);
}

function updateMesh() {
  if (wireframeMesh) {
    const inputs = document.querySelectorAll('input[type="number"]');
    const meshGroup = wireframeMesh.parent;

    meshGroup.position.set(
      parseFloat(inputs[0].value),
      parseFloat(inputs[1].value),
      parseFloat(inputs[2].value)
    );
    meshGroup.rotation.set(
      THREE.MathUtils.degToRad(parseFloat(inputs[3].value)),
      THREE.MathUtils.degToRad(parseFloat(inputs[4].value)),
      THREE.MathUtils.degToRad(parseFloat(inputs[5].value))
    );
    const scale = parseFloat(inputs[6].value);
    meshGroup.scale.set(scale, scale, scale);
    logTransform();
  }
}

function logTransform() {
  const meshGroup = wireframeMesh.parent;
  console.log(
    `Position: ${meshGroup.position.toArray().map((v) => v.toFixed(2))}`
  );
  console.log(
    `Rotation: ${meshGroup.rotation
      .toArray()
      .slice(0, 3)
      .map((v) => THREE.MathUtils.radToDeg(v).toFixed(2))}`
  );
  console.log(`Scale: ${meshGroup.scale.toArray().map((v) => v.toFixed(2))}`);
}

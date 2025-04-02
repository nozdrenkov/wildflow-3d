import React from "react";
import "./Spinner.css";

export default function Spinner() {
  return (
    <div className="sk-chase">
      <div className="sk-chase-dot"></div>
      <div className="sk-chase-dot"></div>
      <div className="sk-chase-dot"></div>
      <div className="sk-chase-dot"></div>
      <div className="sk-chase-dot"></div>
      <div className="sk-chase-dot"></div>
    </div>
  );
}

// This function creates a wrapper component that positions the spinner
// at the provided 3D world position in screen coordinates
export function WorldPositionedSpinner({
  visible,
  worldPos,
  camera,
  renderer,
}) {
  // Return null if not visible or missing position data
  if (!visible || !worldPos || !camera || !renderer) return null;

  // Project the 3D position to screen space
  const screenPos = worldPos.clone().project(camera);

  const canvas = renderer.domElement;
  const x = ((screenPos.x + 1) / 2) * canvas.clientWidth;
  const y = ((-screenPos.y + 1) / 2) * canvas.clientHeight;

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      <Spinner />
    </div>
  );
}

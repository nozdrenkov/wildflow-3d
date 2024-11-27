import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Viewer3D = dynamic(() => import("./Viewer3D"), { ssr: false });

interface Viewer3DWrapperProps {
  modelId: string;
}

export default function Viewer3DWrapper({ modelId }: Viewer3DWrapperProps) {
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [visualProgress, setVisualProgress] = useState(0);

  useEffect(() => {
    document.title =
      visualProgress < 100 ? `Loading ${visualProgress}%` : "Viewer";
  }, [visualProgress]);

  return (
    <div className="relative w-full h-screen">
      {visualProgress < 100 && (
        <div className="absolute top-0 left-0 w-full z-50">
          {/* Amber download progress */}
          <div
            className="absolute top-0 left-0 bg-amber-500 grow-only-transition"
            style={{
              width: `${downloadProgress}%`,
              height: "5px",
            }}
          />
          {/* Green visualization progress */}
          <div
            className="absolute top-0 left-0 bg-green-500 grow-only-transition"
            style={{
              width: `${visualProgress}%`,
              height: "5px",
            }}
          />
        </div>
      )}

      <style jsx>{`
        .grow-only-transition {
          transition: width 300ms ease-out;
          transition-property: width;
          transition-duration: 300ms;
          transition-timing-function: ease-out;
          transition-delay: 0s;
        }
        .grow-only-transition:not([style*="width: 0"]) {
          transition: none;
        }
      `}</style>

      <Viewer3D
        modelId={modelId}
        setDownloadProgress={setDownloadProgress}
        setVisualProgress={setVisualProgress}
      />
    </div>
  );
}

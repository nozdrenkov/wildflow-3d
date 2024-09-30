import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import ProgressBar from "./ProgressBar";

const Viewer3D = dynamic(() => import("./Viewer3D"), { ssr: false });

interface Viewer3DWrapperProps {
  modelId: string;
}

export default function Viewer3DWrapper({ modelId }: Viewer3DWrapperProps) {
  const [progress, setProgress] = useState({ percent: 0, message: "Initializing..." });

  const handleProgress = useCallback((percent: number, message: string) => {
    setProgress({ percent, message });
  }, []);

  useEffect(() => {
    // Show progress bar immediately
    handleProgress(0, "Initializing...");
  }, [handleProgress]);

  return (
    <div className="relative w-full h-screen">
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="text-white text-xl mb-4">
          {progress.message} ({progress.percent.toFixed(2)}%)
        </div>
        <div className="w-64">
          <ProgressBar percent={progress.percent} />
        </div>
      </div>
      <Viewer3D modelId={modelId} onProgress={handleProgress} />
    </div>
  );
}
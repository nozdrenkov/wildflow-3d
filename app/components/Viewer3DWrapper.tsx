import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import ProgressBar from "./ProgressBar";

const Viewer3D = dynamic(() => import("./Viewer3D"), { ssr: false });

interface Viewer3DWrapperProps {
  modelId: string;
}

export default function Viewer3DWrapper({ modelId }: Viewer3DWrapperProps) {
  const [progress, setProgress] = useState({ percent: 0, message: "" });

  const handleProgress = useCallback((percent: number, message: string) => {
    console.log(`Viewer3DWrapper handleProgress: ${percent}%, ${message}`);
    setProgress({ percent, message });
  }, []);

  useEffect(() => {
    console.log("Viewer3DWrapper progress updated:", progress);
  }, [progress]);

  return (
    <div className="relative w-full h-screen">
      <Viewer3D modelId={modelId} onProgress={handleProgress} />
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="text-white text-xl mb-4">
          {progress.message} ({progress.percent.toFixed(2)}%)
        </div>
        <div className="w-64">
          <ProgressBar percent={progress.percent} message={progress.message} />
        </div>
      </div>
    </div>
  );
}
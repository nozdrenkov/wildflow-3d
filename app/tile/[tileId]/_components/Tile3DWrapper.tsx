import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import ProgressBar from "./ProgressBar";

const TileViewer3D = dynamic(() => import("./TileViewer3D"), { ssr: false });

interface Tile3DWrapperProps {
  modelId: string;
  tileX: number;
  tileY: number;
}

export default function Tile3DWrapper({
  modelId,
  tileX,
  tileY,
}: Tile3DWrapperProps) {
  const [progress, setProgress] = useState({
    percent: 0,
    message: "Initializing...",
  });
  const [isLoading, setIsLoading] = useState(true);

  const handleProgress = useCallback((percent: number, message: string) => {
    setProgress({ percent, message });
    if (percent >= 100) {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Show progress bar immediately
    handleProgress(0, "Initializing...");
  }, [handleProgress]);

  return (
    <div className="relative w-full h-screen">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-transparent z-50 pointer-events-none">
          <div className="flex flex-row items-center justify-center">
            <div className="w-64">
              <ProgressBar percent={progress.percent} />
            </div>
            <div className="text-blue-100 text w-16 ml-2">
              {progress.percent.toFixed(0)}%
            </div>
          </div>
          <div className="text-blue-100 text-xs pr-16">{progress.message}</div>
        </div>
      )}
      <TileViewer3D
        modelId={modelId}
        tileX={tileX}
        tileY={tileY}
        onProgress={handleProgress}
      />
    </div>
  );
}

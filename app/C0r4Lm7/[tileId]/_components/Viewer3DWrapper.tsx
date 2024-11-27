import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import ProgressBar from "./ProgressBar";

const Viewer3D = dynamic(() => import("./Viewer3D"), { ssr: false });

interface Viewer3DWrapperProps {
  tileId: string;
}

export default function Viewer3DWrapper({ tileId }: Viewer3DWrapperProps) {
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
      <Viewer3D
        splatsFileUrl={
          "https://storage.googleapis.com/wildflow/C0r4Lm7/high-res-grid-5-ksplat/s5_x-1_y6_m7.ksplat"
        }
        cameraSettings={{
          cameraUp: [-0.88106, 0.36779, -0.29742],
          initialCameraPosition: [-1.2839, 47.3326, 1.32131],
          initialCameraLookAt: [-3.2187, 48.82279, -4.37543],
        }}
        onProgress={handleProgress}
      />
    </div>
  );
}

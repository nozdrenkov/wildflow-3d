import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import ProgressBar from "./ProgressBar";
import { useToast } from "@/hooks/use-toast";
import { getDeviceType } from "../../utils/deviceDetect";
import { useRouter } from "next/navigation";

const Viewer3D = dynamic(() => import("./Viewer3D"), { ssr: false });

interface Viewer3DWrapperProps {
  modelId: string;
}

export default function Viewer3DWrapper({ modelId }: Viewer3DWrapperProps) {
  const deviceInfo = getDeviceType();
  const { toast } = useToast();
  const router = useRouter();
  const [progress, setProgress] = useState({
    percent: 0,
    message: "Initializing...",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTile, setSelectedTile] = useState<{
    tileX: number;
    tileY: number;
    tilePath: string;
  } | null>(null);

  const handleProgress = useCallback((percent: number, message: string) => {
    setProgress({ percent, message });
    if (percent >= 100) {
      setIsLoading(false);
      if (!window.location.search.includes("tile")) {
        toast({
          title: "Double-click on blue box",
          description: "to load high-res model for that area.",
        });

        if (deviceInfo.isLowEndDevice) {
          toast({
            title: "Use more powerful computer",
            description: "This model is cropped for low-end devices.",
          });
        }
      }
    }
  }, []);

  useEffect(() => {
    // Show progress bar immediately
    handleProgress(0, "Initializing...");
  }, [handleProgress]);

  return (
    <div className="relative w-full h-screen">
      {selectedTile && (
        <button
          onClick={() => router.push(selectedTile.tilePath)}
          className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md shadow-md z-50 transition-colors duration-200"
        >
          Open tile ({selectedTile.tileX}, {selectedTile.tileY})
        </button>
      )}

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
        modelId={modelId}
        onProgress={handleProgress}
        setSelectedTile={setSelectedTile}
      />
    </div>
  );
}

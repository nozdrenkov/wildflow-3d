"use client";

import Viewer3DWrapper from "../components/Viewer3DWrapper";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ModelViewer() {
  const { modelId } = useParams();

  return (
    <div className="relative w-full h-screen">
      <Viewer3DWrapper modelId={modelId as string} />
      <div className="absolute bottom-2.5 left-2.5 z-50">
        <Link
          href="https://wildflow.ai"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/favicon.svg"
            alt="Wildflow Logo"
            width={30}
            height={30}
          />
        </Link>
      </div>
      <div className="absolute bottom-0 right-0 z-50 bg-black/70 px-2.5 py-1 text-white font-poppins text-sm leading-[1.4] text-right">
        Data: UCL, LU, IPB...
      </div>
    </div>
  );
}

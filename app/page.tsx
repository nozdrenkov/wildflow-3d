"use client";

import Viewer3DWrapper from "./components/Viewer3DWrapper";
import Image from "next/image";

export default function Home() {
  return (
    <div className="relative w-full h-screen">
      <Viewer3DWrapper />
      <div className="absolute bottom-2.5 left-2.5 z-50">
        <Image src="/favicon.svg" alt="Wildflow Logo" width={30} height={30} />
      </div>
      <div className="absolute bottom-0 right-0 z-50 bg-black/70 px-2.5 py-1 text-white font-poppins text-sm leading-[1.4] text-right">
        Data: UCL, LU, IPB...
      </div>
    </div>
  );
}

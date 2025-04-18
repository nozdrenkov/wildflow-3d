"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Tile3DWrapper from "./_components/Tile3DWrapper";
import Image from "next/image";
import Link from "next/link";
import { fetchContributors } from "../../utils/fetchContributors";

export default function ModelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tileId: string };
}) {
  const [showContributors, setShowContributors] = useState(false);
  const [dataSource, setDataSource] = useState("Loading...");
  const pathname = usePathname();
  const router = useRouter();
  const { tileId } = params;

  const parseTileId = (tileId: string) => {
    const [modelId, tileX, tileY] = tileId.split("_");
    return { modelId, tileX: parseInt(tileX), tileY: parseInt(tileY) };
  };

  const { modelId, tileX, tileY } = parseTileId(tileId);

  useEffect(() => {
    fetchContributors(modelId)
      .then((data) => setDataSource(data.dataSource))
      .catch((error) => console.error("Error fetching contributors:", error));
  }, [modelId]);

  useEffect(() => {
    setShowContributors(pathname.endsWith("/contributors"));
  }, [pathname]);

  const handleContributorsToggle = () => {
    if (showContributors) {
      router.push(`/tile/${tileId}`);
    } else {
      router.push(`/${modelId}/contributors`);
    }
  };

  return (
    <div className="relative w-full h-screen">
      <Tile3DWrapper modelId={modelId} tileX={tileX} tileY={tileY} />
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
        <button onClick={handleContributorsToggle} className="hover:underline">
          {dataSource}
        </button>
      </div>
      {showContributors && children}
    </div>
  );
}

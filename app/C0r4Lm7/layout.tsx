"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Viewer3DWrapper from "./_components/Viewer3DWrapper";
import Image from "next/image";
import Link from "next/link";
import { fetchContributors } from "../utils/fetchContributors";

const modelId = "C0r4Lm7";

export default function ModelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dataSource, setDataSource] = useState("Loading...");
  const router = useRouter();

  useEffect(() => {
    fetchContributors(modelId)
      .then((data) => setDataSource(data.dataSource))
      .catch((error) => console.error("Error fetching contributors:", error));
  }, [modelId]);

  const handleContributorsToggle = () => {
    router.push(`/${modelId}/contributors`);
  };

  return (
    <div className="relative w-full h-screen">
      <Viewer3DWrapper modelId={modelId} />
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
      {children}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Viewer3DWrapper from "./_components/Viewer3DWrapper";
import Image from "next/image";
import Link from "next/link";
import { fetchContributors } from "../utils/fetchContributors";

// Use this hard-coded modelId instead of relying on params
const hardcodedModelId = "T4bUHn";

export default function ModelLayout({
  children, // params,
}: {
  children: React.ReactNode;
  // params: { modelId: string };
}) {
  const [showContributors, setShowContributors] = useState(false);
  const [dataSource, setDataSource] = useState("Loading...");
  const pathname = usePathname();
  const router = useRouter();

  // Remove this line that's causing the issue
  // const { modelId } = params;

  useEffect(() => {
    fetchContributors(hardcodedModelId)
      .then((data) => setDataSource(data.dataSource))
      .catch((error) => console.error("Error fetching contributors:", error));
  }, []); // Remove modelId from dependency array since we're using hardcodedModelId

  useEffect(() => {
    setShowContributors(pathname.endsWith("/contributors"));
  }, [pathname]);

  const handleContributorsToggle = () => {
    if (showContributors) {
      router.push(`/${hardcodedModelId}`);
    } else {
      router.push(`/${hardcodedModelId}/contributors`);
    }
  };

  return (
    <div className="relative w-full h-screen">
      <Viewer3DWrapper />
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

"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { fetchOrthoContributors } from "../../utils/fetchOrthoContributors";

export default function OrthoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { orthoId: string };
}) {
  const [showContributors, setShowContributors] = useState(false);
  const [dataSource, setDataSource] = useState("Loading...");
  const pathname = usePathname();
  const router = useRouter();
  const { orthoId } = params;

  useEffect(() => {
    fetchOrthoContributors(orthoId)
      .then((data) => setDataSource(data.dataSource))
      .catch((error) => console.error("Error fetching contributors:", error));
  }, [orthoId]);

  useEffect(() => {
    setShowContributors(pathname.endsWith("/contributors"));
  }, [pathname]);

  const handleContributorsToggle = () => {
    if (showContributors) {
      router.push(`/o/${orthoId}`);
    } else {
      router.push(`/o/${orthoId}/contributors`);
    }
  };

  return (
    <div className="relative w-full h-screen">
      {!showContributors && children}
      <div className="absolute bottom-2.5 left-2.5 z-[1000]">
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
      <div className="absolute bottom-0 right-0 z-[1000] bg-black/70 px-2.5 py-1 text-white font-poppins text-sm leading-[1.4] text-right">
        <button onClick={handleContributorsToggle} className="hover:underline">
          {dataSource}
        </button>
      </div>
      {showContributors && children}
    </div>
  );
}

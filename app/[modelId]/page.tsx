"use client";

import { useState } from "react";
import Viewer3DWrapper from "../components/Viewer3DWrapper";
import Image from "next/image";
import Link from "next/link";
import { XMarkIcon } from "@heroicons/react/24/solid";

export default function ModelViewer({
  params,
}: {
  params: { modelId: string };
}) {
  const [showContributors, setShowContributors] = useState(false);
  const { modelId } = params;

  const contributors = [
    "Rindah Talitha Vida",
    "Tries B. Razak",
    "Andrew O. M. Mogg",
    "Ronan Roche",
    "Jason Lynch",
    "Ben Williams",
    "Mars Coral Restoration Project Monitoring Team",
    "Cut Aja Gita Alisa",
    "Beginer Subhan",
    "Syamsul B. Agus",
    "Nicholas A. J. Graham",
    "Timothy A. C. Lamont",
  ];

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
        <button
          onClick={() => setShowContributors(true)}
          className="hover:underline"
        >
          Data: UCL, LEC-REEFS, IPB...
        </button>
      </div>
      {showContributors && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-black text-white p-8 relative max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg">
            <button
              onClick={() => setShowContributors(false)}
              className="absolute top-4 right-4"
            >
              <XMarkIcon className="h-6 w-6 text-white hover:text-gray-300" />
            </button>
            <h1 className="text-3xl font-bold mb-6">Contributors</h1>
            <p className="mb-4">
              Huge thanks for this data to these people from UCL, LU, IPB and
              Mars:
            </p>
            <ul className="list-disc list-inside space-y-2">
              {contributors.map((contributor, index) => (
                <li key={index}>{contributor}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/solid";

export default function Contributors() {
  const router = useRouter();

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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-black text-white p-8 relative max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg">
        <button
          onClick={() => router.back()}
          className="absolute top-4 right-4"
        >
          <XMarkIcon className="h-6 w-6 text-white hover:text-gray-300" />
        </button>
        <h1 className="text-3xl font-bold mb-6">Contributors</h1>
        <p className="mb-4">
          Huge thanks for this data to these people from UCL, LU, IPB and Mars:
        </p>
        <ul className="list-disc list-inside space-y-2">
          {contributors.map((contributor, index) => (
            <li key={index}>{contributor}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

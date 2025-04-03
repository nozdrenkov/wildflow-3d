"use client";

import { useRouter } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { fetchContributors } from "../../utils/fetchContributors";
import { useEffect, useState } from "react";
import { ReactNode } from "react";

// Hardcode the modelId for this specific route
const hardcodedModelId = "DZVNm9";

export default function Contributors() {
  const router = useRouter();
  // Don't destructure modelId from params, use the hardcoded value
  // const { modelId } = params;

  const [contributorsContent, setContributorsContent] =
    useState<ReactNode | null>(null);

  useEffect(() => {
    fetchContributors(hardcodedModelId)
      .then((data) => {
        setContributorsContent(data.contributorsContent);
      })
      .catch((error) => console.error("Error fetching contributors:", error));
  }, []); // Remove modelId from dependency array

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-black text-white p-8 relative max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg">
        <button
          onClick={() => router.back()}
          className="absolute top-4 right-4"
        >
          <XMarkIcon className="h-6 w-6 text-white hover:text-gray-300" />
        </button>
        <div className="space-y-4">{contributorsContent}</div>
      </div>
    </div>
  );
}

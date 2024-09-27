import Link from "next/link";
import { XMarkIcon } from "@heroicons/react/24/solid";

export default function Contributors({
  params,
}: {
  params: { modelId: string };
}) {
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
    <div className="min-h-screen bg-black text-white p-8 relative">
      <Link href={`/${modelId}`} className="absolute top-4 right-4">
        <XMarkIcon className="h-6 w-6 text-white hover:text-gray-300" />
      </Link>
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
  );
}

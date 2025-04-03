import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl mb-4">Welcome to Wildflow Coral 3D Viewer</h1>
      <p className="mb-4">Enter a model ID in the URL to view a 3D model.</p>
      <Link href="/C0r4Lm7" className="text-blue-500 hover:underline">
        C0r4Lm7 - MARS: Sailisi Kecil Healthy M7
      </Link>
      <Link href="/DZVNm9" className="text-blue-500 hover:underline">
        DZVNm9 - MARS: Block 7 M9
      </Link>
    </div>
  );
}

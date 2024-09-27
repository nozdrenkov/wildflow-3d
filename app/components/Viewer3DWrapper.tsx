import dynamic from "next/dynamic";

const Viewer3D = dynamic(() => import("./Viewer3D"), { ssr: false });

export default function Viewer3DWrapper() {
  return <Viewer3D />;
}

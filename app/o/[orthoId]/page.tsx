import OrthoViewer from "./_components/OrthoViewer";

export default function OrthoPage({ params }: { params: { orthoId: string } }) {
  return <OrthoViewer orthoId={params.orthoId} />;
}

import OrthoViewer from "./_components/OrthoViewer";

export default async function OrthoPage({ params }: { params: Promise<{ orthoId: string }> }) {
  const { orthoId } = await params;
  return <OrthoViewer orthoId={orthoId} />;
}

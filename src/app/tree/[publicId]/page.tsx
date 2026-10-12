import type { Metadata } from "next";
import { PublicTree } from "./PublicTree";

export const metadata: Metadata = {
  title: "Silsilah keluarga yang dibagikan — Heritg",
  description: "Silsilah keluarga yang dibagikan lewat Heritg, hanya untuk dilihat dan tidak terdaftar publik.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PublicTreePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <PublicTree publicId={publicId} />;
}

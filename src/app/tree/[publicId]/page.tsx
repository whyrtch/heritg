import type { Metadata } from "next";
import { PublicTree } from "./PublicTree";

export const metadata: Metadata = {
  title: "Shared family tree — Heritg",
  description: "An unlisted, read-only family tree shared through Heritg.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PublicTreePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <PublicTree publicId={publicId} />;
}

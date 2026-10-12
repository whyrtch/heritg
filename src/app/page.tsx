"use client";

import { useT } from "@/i18n";
import { Workspace } from "@/features/tree/Workspace";
import { RequireOwner } from "@/features/auth/RequireOwner";

export default function Home() {
  const t = useT();
  return <RequireOwner><main aria-label={t("app.workspace")}><Workspace /></main></RequireOwner>;
}

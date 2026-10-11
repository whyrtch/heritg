import { Workspace } from "@/features/tree/Workspace";
import { RequireOwner } from "@/features/auth/RequireOwner";

export default function Home() {
  return <RequireOwner><main aria-label="Family tree workspace"><Workspace /></main></RequireOwner>;
}

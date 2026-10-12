import { Workspace } from "@/features/tree/Workspace";
import { AuthLoginForm } from "@/features/auth/AuthLoginForm";
import { OwnerSession } from "@/features/auth/OwnerSession";

export default function Home() {
  return (
    <main aria-label="Family tree workspace">
      <Workspace />
      <AuthLoginForm />
      <OwnerSession />
    </main>
  );
}

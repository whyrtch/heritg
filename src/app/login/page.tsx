"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Leaf } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAuthErrorMessage } from "@/features/auth/authErrors";
import { useAuth } from "@/features/auth/useAuth";
import { SilsilahIllustration } from "./SilsilahIllustration";
import styles from "./login.module.css";

export default function LoginPage() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "help">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [router, status]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.page}>
    <aside className={styles.story}>
      <div className={styles.brand}><span><Leaf aria-hidden="true" /></span>Heritg</div>
      <SilsilahIllustration variant="panel" className={styles.illustrationPanel} />
      <SilsilahIllustration variant="band" className={styles.illustrationBand} />
      <SilsilahIllustration variant="compact" className={styles.illustrationCompact} />
      <p className={styles.storyLine}>Keep your family’s story in one place, private until you choose to share it.</p>
    </aside>
    <section className={styles.card} aria-labelledby="login-title">
      <h1 id="login-title">{mode === "login" ? "Welcome back" : "Forgot your password?"}</h1>
      <p className={styles.lede}>{mode === "login" ? "Sign in with the owner account for this archive." : "This archive has no email service, so passwords are reset on the server by whoever runs it."}</p>

      {mode === "help" ? <div className={styles.feedback}><span className={styles.success}>Run <code>npm run owner:reset-password</code> on the server, then sign in with the new password. Every device is signed out.</span></div> : <form onSubmit={submit}>
        <label>Email address<input autoComplete="email" type="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label>Password<span className={styles.password}><input autoComplete="current-password" type={showPassword ? "text" : "password"} required value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
        <div className={styles.feedback} aria-live="polite">{error && <span className={styles.error} role="alert">{error}</span>}{message && <span className={styles.success}>{message}</span>}</div>
        <button className={styles.submit} type="submit" disabled={busy || status === "loading"}>{busy ? "Please wait…" : "Sign in"}</button>
      </form>}
      <button className={styles.mode} type="button" onClick={() => { setMode(value => value === "login" ? "help" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Forgot your password?" : "Back to sign in"}</button>
      <p className={styles.note}>Only the archive owner has an account. Family members view trees through links the owner shares.</p>
    </section>
  </main>;
}

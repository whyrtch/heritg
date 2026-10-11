"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Leaf } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAuthErrorMessage } from "@/features/auth/authErrors";
import { useAuth } from "@/features/auth/useAuth";
import { SilsilahIllustration } from "./SilsilahIllustration";
import styles from "./login.module.css";

export default function LoginPage() {
  const { status, signIn, resetPassword } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "reset">("login");
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
      if (mode === "reset") {
        await resetPassword(email.trim());
        setMessage("If an account exists for that email, a reset link has been sent.");
      } else {
        await signIn(email.trim(), password);
        router.replace("/");
      }
    } catch (cause) {
      if (mode === "reset") setMessage("If an account exists for that email, a reset link has been sent.");
      else setError(getAuthErrorMessage(cause));
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
      <h1 id="login-title">{mode === "login" ? "Welcome back" : "Reset your password"}</h1>
      <p className={styles.lede}>{mode === "login" ? "Sign in with the owner account for this archive." : "Enter your owner email and we’ll send reset instructions."}</p>

      {status === "configuration-error" && <p className={styles.error} role="alert">Firebase configuration is missing. Add the values from .env.example to .env.local.</p>}
      <form onSubmit={submit}>
        <label>Email address<input autoComplete="email" type="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
        {mode === "login" && <label>Password<span className={styles.password}><input autoComplete="current-password" type={showPassword ? "text" : "password"} required value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>}
        <div className={styles.feedback} aria-live="polite">{error && <span className={styles.error} role="alert">{error}</span>}{message && <span className={styles.success}>{message}</span>}</div>
        <button className={styles.submit} type="submit" disabled={busy || status === "loading" || status === "configuration-error"}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Send reset link"}</button>
      </form>
      <button className={styles.mode} type="button" onClick={() => { setMode(value => value === "login" ? "reset" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Forgot your password?" : "Back to sign in"}</button>
      <p className={styles.note}>Only the archive owner has an account. Family members view trees through links the owner shares.</p>
    </section>
  </main>;
}

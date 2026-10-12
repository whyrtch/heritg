"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { useAuth } from "./useAuth";
import styles from "./auth.module.css";

export function AuthLoginForm() {
  const { user, status, signIn, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (status === "authenticated" && user) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await register(email, password, fullName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPanel}>
      <form onSubmit={handleSubmit}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`${styles.tab} ${mode === "register" ? styles.tabActive : ""}`}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <div className={styles.fields}>
          {mode === "register" && (
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
              className={styles.input}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            className={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            className={styles.input}
            required
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={styles.submitButton} disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>
    </div>
  );
}

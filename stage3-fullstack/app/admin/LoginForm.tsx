"use client";

/**
 * LoginForm — email/password sign-in gate for the admin dashboard.
 *
 * Uses Supabase Auth `signInWithPassword`. The parent (<AdminDashboard/>) owns
 * the session state and re-renders the dashboard once auth succeeds (via the
 * onAuthStateChange subscription), so this component only needs to trigger the
 * sign-in and surface any error.
 */

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import styles from "./admin.module.css";

export default function LoginForm({ supabase }: { supabase: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) setError(error.message);
      // On success, the parent's onAuthStateChange listener swaps in the dashboard.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login">
      <h1>
        Admin <span className="text-accent">sign in</span>
      </h1>
      <p className="lead">Sign in with your SliceMatic admin account to view orders and insights.</p>

      <form className={`card ${styles.loginCard}`} onSubmit={onSubmit}>
        <label htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
        />

        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        {error && (
          <div className="notice notice-warn" role="alert" style={{ marginTop: "1rem" }}>
            {error}
          </div>
        )}

        <button className="btn" type="submit" disabled={busy} style={{ marginTop: "1.1rem" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: "0.9rem" }}>
        Admin accounts are created in the Supabase dashboard (Authentication → Users). See the
        README for setup.
      </p>
    </div>
  );
}

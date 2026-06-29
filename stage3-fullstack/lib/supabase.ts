/**
 * supabase.ts — lazy Supabase client factories.
 *
 * Clients are created INSIDE functions (never at module top-level) so that
 * `next build` never touches env vars and never throws at import time when
 * secrets are absent. Callers must handle a null/throw and degrade gracefully.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both NEXT_PUBLIC Supabase env vars are present and non-empty. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL() && SUPABASE_ANON_KEY());
}

// Cache the browser singleton so we don't spawn multiple GoTrue clients.
let browserClient: SupabaseClient | null = null;

/**
 * Browser-side client (uses the public anon key; safe to expose — RLS guards
 * the data). Returns `null` when Supabase is not configured so the UI can show
 * a "Configure .env.local (see README)" notice instead of crashing.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;
  browserClient = createClient(SUPABASE_URL()!, SUPABASE_ANON_KEY()!);
  return browserClient;
}

/**
 * Server-side client (API routes / server components). Uses the same anon key.
 * Persists no session (server is stateless). THROWS when not configured — call
 * `isSupabaseConfigured()` first in code paths that must degrade gracefully.
 */
export function getSupabaseServer(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see README)."
    );
  }
  return createClient(SUPABASE_URL()!, SUPABASE_ANON_KEY()!, {
    auth: { persistSession: false },
  });
}

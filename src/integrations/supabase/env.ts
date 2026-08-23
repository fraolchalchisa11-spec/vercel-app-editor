/**
 * Supabase connection config for YOUR OWN Supabase project.
 *
 * The URL and publishable (anon) key are safe to ship in the client bundle.
 * They are hardcoded here as a fallback so the app works in the Lovable
 * preview, on Vercel, and locally without Lovable Cloud being involved.
 *
 * Set these in Vercel (Project Settings -> Environment Variables) to override:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY  (client + SSR)
 *   SUPABASE_SERVICE_ROLE_KEY or APP_SUPABASE_SERVICE_ROLE_KEY (server only)
 */
const FALLBACK_SUPABASE_URL = "https://hrvrinjsabwzgrvqpdxp.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Rmihd9M3dwGTgYeieYy3eg__CVqhnbw";

function fromProcess(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const value = process.env?.[name];
  return value ? value : undefined;
}

export function getSupabaseUrl(): string {
  return (
    (import.meta.env?.["VITE_SUPABASE_URL"] as string | undefined) ||
    fromProcess("SUPABASE_URL") ||
    FALLBACK_SUPABASE_URL
  );
}

export function getSupabasePublishableKey(): string {
  return (
    (import.meta.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ||
    fromProcess("SUPABASE_PUBLISHABLE_KEY") ||
    FALLBACK_SUPABASE_PUBLISHABLE_KEY
  );
}

/** Server-only. Empty string when not configured. */
export function getSupabaseServiceRoleKey(): string {
  return (
    fromProcess("SUPABASE_SERVICE_ROLE_KEY") || fromProcess("APP_SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

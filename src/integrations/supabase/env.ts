/**
 * Supabase connection config for the dedicated BTR backend.
 * Publishable keys are safe in browser code. Service-role keys must remain
 * server-only and must be configured as Vercel environment variables.
 */
const FALLBACK_SUPABASE_URL = "https://phkzurfmegscjpggklcl.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ydqf8W1aAUYHZog88dLrug_vSNF3T3-";

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
    fromProcess("SUPABASE_SERVICE_ROLE_KEY") ||
    fromProcess("APP_SUPABASE_SERVICE_ROLE_KEY") ||
    ""
  );
}

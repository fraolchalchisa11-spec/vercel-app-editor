import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (typeof process !== "undefined" ? process.env?.["SUPABASE_URL"] : undefined) ??
  "";

const supabaseKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (typeof process !== "undefined" ? process.env?.["SUPABASE_PUBLISHABLE_KEY"] : undefined) ??
  "";

const isBrowser = typeof window !== "undefined";

/**
 * Browser Supabase client for your own Supabase project.
 * RLS applies as the signed-in user.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
    storage: isBrowser ? window.localStorage : undefined,
  },
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

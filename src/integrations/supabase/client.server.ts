import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

function makeFetch(key: string): typeof fetch {
  // Opaque sb_publishable_/sb_secret_ keys aren't JWTs; PostgREST rejects them
  // as bearer tokens, so send them only via the apikey header.
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input as any, { ...init, headers });
  };
}

/** Service-role client. Bypasses RLS — server-only, privileged operations only. */
export const supabaseAdmin: SupabaseClient<Database> = createClient<Database>(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: makeFetch(process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "") },
  },
);

/** Publishable-key client for public, RLS-respecting reads inside server code. */
export function createServerPublicClient(): SupabaseClient<Database> {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: { fetch: makeFetch(key) },
  });
}

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Example authenticated server function: returns the signed-in user, verified
 * server-side against your Supabase project. Copy this shape for your own
 * data access (RLS applies as the user via context.supabase).
 */
export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    id: context.userId,
    email: context.user.email ?? null,
    createdAt: context.user.created_at,
  }));

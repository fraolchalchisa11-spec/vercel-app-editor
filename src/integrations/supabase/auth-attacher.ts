import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "./client";

/** Attaches the signed-in user's access token to every server-function call. */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") return next();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return next();

    return next({
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  },
);

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

type Options = {
  /** Table name in the public schema. */
  table: string;
  /** Optional PostgREST filter, e.g. `user_id=eq.<uuid>`. */
  filter?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  enabled?: boolean;
};

/**
 * Subscribes to Postgres changes for a table.
 * Enable Realtime for the table in your Supabase dashboard first.
 */
export function useRealtimeTable(
  { table, filter, event = "*", enabled = true }: Options,
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, any>>) => void,
) {
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`realtime:${table}:${filter ?? "all"}`)
      .on(
        "postgres_changes",
        { event, schema: "public", table, ...(filter ? { filter } : {}) } as any,
        (payload: RealtimePostgresChangesPayload<Record<string, any>>) => onChange(payload),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, event, enabled]);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type JsonObject = Record<string, any>;
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROW_ID = "main";

export async function readAppState(): Promise<{ data: JsonObject }> {
  const { data, error } = await supabaseAdmin
    .from("app_state")
    .select("data")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { data: (data?.data as JsonObject) ?? {} };
}

export async function writeAppState(
  payload: JsonObject,
): Promise<{ data: JsonObject }> {
  // Safety net: refuse a write that would wipe most student accounts at once.
  const current = await readAppState();
  const beforeList = current.data?.["students"];
  const afterList = payload?.["students"];
  const before = Array.isArray(beforeList) ? beforeList.length : 0;
  const after = Array.isArray(afterList) ? afterList.length : 0;
  if (before >= 5 && after < before * 0.5) {
    throw new Error("Save blocked: it would remove most student accounts.");
  }
  // Keep a backup copy of the previous state before overwriting.
  if (before > 0) {
    await supabaseAdmin
      .from("app_state")
      .upsert({ id: "backup", data: current.data as never, updated_at: new Date().toISOString() });
  }
  const { data, error } = await supabaseAdmin
    .from("app_state")
    .upsert({ id: ROW_ID, data: payload as never, updated_at: new Date().toISOString() })
    .select("data")
    .single();

  if (error) throw new Error(error.message);
  return { data: (data?.data as JsonObject) ?? payload };
}

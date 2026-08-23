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
  const { data, error } = await supabaseAdmin
    .from("app_state")
    .upsert({ id: ROW_ID, data: payload as never, updated_at: new Date().toISOString() })
    .select("data")
    .single();

  if (error) throw new Error(error.message);
  return { data: (data?.data as JsonObject) ?? payload };
}

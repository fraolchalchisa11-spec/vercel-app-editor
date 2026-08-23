import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "uploads";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

export async function storeUpload(input: {
  folder: string;
  filename: string;
  contentType: string;
  base64: string;
}): Promise<{ url: string }> {
  const binary = atob(input.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const folder = safeName(input.folder || "misc");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName(input.filename || "file")}`;

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
    contentType: input.contentType || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return { url: `/api/public/files/${path}` };
}

export async function fetchUpload(path: string) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return data;
}

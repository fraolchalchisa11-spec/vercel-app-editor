import { useCallback, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type UploadResult = { path: string; publicUrl: string };

/** Upload/download/remove helper for a Supabase Storage bucket. */
export function useSupabaseUpload(bucket: string) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File, pathPrefix = ""): Promise<UploadResult | null> => {
      setUploading(true);
      setError(null);
      try {
        const safeName = file.name.replace(/[^\w.\-]/g, "_");
        const path = `${pathPrefix ? `${pathPrefix.replace(/\/$/, "")}/` : ""}${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, { upsert: false, contentType: file.type });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return { path, publicUrl: data.publicUrl };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        return null;
      } finally {
        setUploading(false);
      }
    },
    [bucket],
  );

  const createSignedUrl = useCallback(
    async (path: string, expiresInSeconds = 3600) => {
      const { data, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);
      if (signError) {
        setError(signError.message);
        return null;
      }
      return data.signedUrl;
    },
    [bucket],
  );

  const remove = useCallback(
    async (paths: string[]) => {
      const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
      if (removeError) setError(removeError.message);
      return !removeError;
    },
    [bucket],
  );

  return { upload, createSignedUrl, remove, uploading, error };
}

import { createFileRoute } from "@tanstack/react-router";

/**
 * Neutral alias for uploaded media. Some mobile browsers and built-in
 * ad-blockers refuse to load URLs containing an "ads" path segment, so promo
 * banners are served from this path instead. "promo/…" maps to the legacy
 * "ads/…" folder inside the storage bucket.
 */
export const Route = createFileRoute("/api/public/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = (params as { _splat?: string })._splat || "";
        if (!raw) return new Response("Not found", { status: 404 });
        const path = raw.startsWith("promo/") ? `ads/${raw.slice("promo/".length)}` : raw;

        const { fetchUpload } = await import("@/lib/upload-file.server");
        const blob = await fetchUpload(path);
        if (!blob) return new Response("Not found", { status: 404 });

        return new Response(blob, {
          headers: {
            "content-type": blob.type || "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});

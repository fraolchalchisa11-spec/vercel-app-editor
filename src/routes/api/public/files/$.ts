import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/files/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat || "";
        if (!path) return new Response("Not found", { status: 404 });

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

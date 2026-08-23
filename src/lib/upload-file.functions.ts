import { createServerFn } from "@tanstack/react-start";

export const uploadFileToStorage = createServerFn({ method: "POST" })
  .validator(
    (input: { folder: string; filename: string; contentType: string; base64: string }) => input,
  )
  .handler(async ({ data }) => {
    const { storeUpload } = await import("./upload-file.server");
    return await storeUpload(data);
  });

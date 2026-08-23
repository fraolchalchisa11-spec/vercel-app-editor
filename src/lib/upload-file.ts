import { uploadFileToStorage } from "./upload-file.functions";

const MAX_BYTES = 15 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

async function upload(file: File, folder: string, allowed: (type: string, name: string) => boolean) {
  if (!file) throw new Error("No file selected");
  if (file.size > MAX_BYTES) throw new Error("File is too large (max 15MB)");
  if (!allowed(file.type || "", file.name || "")) throw new Error("Unsupported file type");

  const base64 = await fileToBase64(file);
  const res = await uploadFileToStorage({
    data: {
      folder,
      filename: file.name || "file",
      contentType: file.type || "application/octet-stream",
      base64,
    },
  });
  return res.url;
}

export function uploadImageFile(file: File, folder = "images") {
  return upload(file, folder, (type) => type.startsWith("image/"));
}

export function uploadHtmlFile(file: File, folder = "documents") {
  return upload(
    file,
    folder,
    (type, name) => type.includes("html") || /\.(html?|htm)$/i.test(name),
  );
}

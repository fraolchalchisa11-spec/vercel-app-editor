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

const MAX_DIMENSION: Record<string, number> = { logos: 512, "plan-icons": 256, "profile-pictures": 512 };

/** Resize + convert to WebP in the browser before uploading. Falls back to the original file. */
async function compressImage(file: File, maxDim: number): Promise<File> {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.82));
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    const name = (file.name || "image").replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}

export async function uploadImageFile(file: File, folder = "images") {
  const small = file ? await compressImage(file, MAX_DIMENSION[folder] ?? 1280) : file;
  return upload(small, folder, (type) => type.startsWith("image/"));
}

export function uploadHtmlFile(file: File, folder = "documents") {
  return upload(
    file,
    folder,
    (type, name) => type.includes("html") || /\.(html?|htm)$/i.test(name),
  );
}

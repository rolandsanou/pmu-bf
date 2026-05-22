import { mkdir, writeFile } from "fs/promises";
import path from "path";

const cloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

/**
 * Persists a ticket photo and returns a public URL.
 *
 * - In production (Cloudinary env set) it uploads to Cloudinary, so photos
 *   survive on hosts with an ephemeral filesystem (Render/Vercel free tiers).
 * - Without Cloudinary it writes to the uploads dir and returns an /api/tickets
 *   URL served by a route handler (Next does not reliably serve files added to
 *   public/ at runtime in production).
 */
export async function saveTicketPhoto(
  bytes: Buffer,
  ext: string,
  key: string
): Promise<string> {
  if (cloudinaryConfigured) {
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    return new Promise<string>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "tickets", public_id: key, resource_type: "image" },
          (error, result) => {
            if (error || !result) return reject(error ?? new Error("Upload échoué"));
            resolve(result.secure_url);
          }
        )
        .end(bytes);
    });
  }

  const dir = path.join(process.cwd(), "public", "uploads", "tickets");
  await mkdir(dir, { recursive: true });
  const fileName = `${key}.${ext}`;
  await writeFile(path.join(dir, fileName), bytes);
  return `/api/tickets/${fileName}`;
}

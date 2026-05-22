import { readFile } from "fs/promises";
import path from "path";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

// Serves a ticket photo stored on disk (used when Cloudinary isn't configured).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const download = new URL(req.url).searchParams.get("dl") === "1";
  const safe = path.basename(name);
  if (safe !== name || !/^[A-Za-z0-9._-]+$/.test(safe)) {
    return new Response("Not found", { status: 404 });
  }

  const ext = (safe.split(".").pop() || "").toLowerCase();
  const file = path.join(process.cwd(), "public", "uploads", "tickets", safe);

  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": TYPES[ext] ?? "application/octet-stream",
    "Cache-Control": "public, max-age=86400",
  };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${safe}"`;
  }

  return new Response(new Uint8Array(bytes), { headers });
}

import { put } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireRole } from "../../auth/server";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-{2,}/g, "-").slice(0, 96);
}

async function ownerHash(ownerId: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ownerId.toLowerCase()));
  return Array.from(new Uint8Array(digest).slice(0, 8)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    const authorization = await requireRole(request, ["generator"]);
    if (!authorization.ok) {
      if (authorization.response.status === 401) {
        return Response.json(
          { success: false, error: "Authentication required" },
          { status: 401 },
        );
      }
      return Response.json(
        { success: false, error: "Not authorized to upload images" },
        { status: 403 },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return Response.json(
        { success: false, error: "A multipart image upload is required" },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File) || !SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
      return Response.json(
        { success: false, error: "A valid JPEG, PNG, or WebP image is required" },
        { status: 400 },
      );
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      return Response.json(
        { success: false, error: "The image must be between 1 byte and 10 MB" },
        { status: 413 },
      );
    }

    const owner = await ownerHash(authorization.session.mobile);
    const pathname = `waste-images/${owner}/${crypto.randomUUID()}-${safeFilename(file.name || "site-image")}`;
    let objectKey: string;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(pathname, file, { access: "public", addRandomSuffix: false });
      objectKey = blob.url;
    } else {
      const destination = path.join(process.cwd(), "public", "uploads", pathname);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, Buffer.from(await file.arrayBuffer()));
      objectKey = `/uploads/${pathname}`;
    }

    return Response.json(
      {
        success: true,
        objectKey,
        filename: file.name,
        size: file.size,
        contentType: file.type,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[api/uploads] POST failed", error);
    return Response.json(
      {
        success: false,
        error: "Image upload failed",
        details: "An unexpected server error occurred.",
      },
      { status: 500 },
    );
  }
}

import { put } from "@vercel/blob";
import { requireRole } from "../../auth/server";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BLOB_TOKEN_PATTERN = /^vercel_blob_rw_[A-Za-z0-9]+_[A-Za-z0-9_-]+$/;

function inferenceMode() {
  return process.env.CDW_INFERENCE_MODE?.trim().toLowerCase() === "production"
    ? "production"
    : "prototype";
}

function configuredBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token && BLOB_TOKEN_PATTERN.test(token) ? token : null;
}

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

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      console.error("[api/uploads] Multipart parsing failed", error);
      return Response.json(
        { success: false, error: "The multipart image data could not be parsed" },
        { status: 400 },
      );
    }
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

    if (inferenceMode() === "prototype") {
      return Response.json(
        {
          success: true,
          imageUrl: null,
          storage: "prototype-disabled",
        },
        { status: 200 },
      );
    }

    const token = configuredBlobToken();
    if (!token) {
      return Response.json(
        {
          success: false,
          error: "Image storage is not configured",
          details: "Set a valid BLOB_READ_WRITE_TOKEN on Render for production uploads.",
        },
        { status: 503 },
      );
    }

    const owner = await ownerHash(authorization.session.mobile);
    const pathname = `waste-images/${owner}/${crypto.randomUUID()}-${safeFilename(file.name || "site-image")}`;
    let imageUrl: string;
    try {
      const blob = await put(pathname, file, {
        access: "public",
        addRandomSuffix: false,
        token,
      });
      imageUrl = blob.url;
    } catch (error) {
      console.error("[api/uploads] Vercel Blob upload failed", error);
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const tokenRejected =
        message.includes("access denied") ||
        message.includes("invalid token") ||
        message.includes("credentials");
      return Response.json(
        {
          success: false,
          error: tokenRejected ? "Image storage token was rejected" : "Image storage is unavailable",
          details: tokenRejected
            ? "Vercel Blob rejected BLOB_READ_WRITE_TOKEN. Replace the token on Render and redeploy."
            : "Vercel Blob could not store the image. Please retry shortly.",
        },
        { status: tokenRejected ? 503 : 502 },
      );
    }

    return Response.json(
      {
        success: true,
        imageUrl,
        storage: "vercel-blob",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[api/uploads] POST failed", error);
    return Response.json(
      {
        success: false,
        error: "Image upload failed",
        details: "The server could not complete the image upload. Check the Render logs and retry.",
      },
      { status: 500 },
    );
  }
}

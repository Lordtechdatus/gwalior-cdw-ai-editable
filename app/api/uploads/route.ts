import { requireRole } from "../../auth/server";

function safeFilename(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 96);
}

async function ownerHash(ownerId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ownerId.toLowerCase()),
  );
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  const { env } = await import("cloudflare:workers");
  const authorization = await requireRole(request, ["generator"]);
  if (!authorization.ok) return authorization.response;

  const formData = await request.formData();
  const file = formData.get("image");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return Response.json({ error: "A valid image is required." }, { status: 400 });
  }
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "The image must not exceed 10 MB." }, { status: 413 });
  }
  if (!env.BUCKET) {
    return Response.json({ error: "Object storage is unavailable." }, { status: 503 });
  }

  const owner = await ownerHash(authorization.session.mobile);
  const objectKey = `waste-images/${owner}/${crypto.randomUUID()}-${safeFilename(file.name || "site-image")}`;
  await env.BUCKET.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      owner,
      uploadedAt: new Date().toISOString(),
      purpose: "cdw-waste-report",
    },
  });

  return Response.json(
    {
      objectKey,
      filename: file.name,
      size: file.size,
      contentType: file.type,
    },
    { status: 201 },
  );
}

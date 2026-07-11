import { noStoreJson, selectSessionRole } from "../../../auth/server";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { role?: unknown };
  const session = await selectSessionRole(request, payload.role);
  if (!session) return noStoreJson({ error: "You are not authorized to access this workspace." }, { status: 403 });
  return noStoreJson({ selected: true, role: session.role });
}

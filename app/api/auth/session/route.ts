import { getSession, noStoreJson } from "../../../auth/server";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return noStoreJson({ authenticated: false }, { status: 401 });
  return noStoreJson({ authenticated: true, mobile: session.mobile, role: session.role });
}

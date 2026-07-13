import { getSession, noStoreJson } from "../../../auth/server";

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) return noStoreJson({ authenticated: false }, { status: 401 });
    return noStoreJson({ authenticated: true, mobile: session.mobile, role: session.role });
  } catch (error) {
    console.error("[api/auth/session] GET failed", error);
    return noStoreJson({ authenticated: false }, { status: 401 });
  }
}

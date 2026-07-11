import { clearSessionCookie, destroySession, noStoreJson } from "../../../auth/server";

export async function POST(request: Request) {
  await destroySession(request);
  return noStoreJson({ loggedOut: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}

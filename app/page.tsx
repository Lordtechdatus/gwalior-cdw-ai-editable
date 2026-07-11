import { getChatGPTUser } from "./chatgpt-auth";
import CdwPlatform from "./components/CdwPlatform";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  return (
    <CdwPlatform
      viewer={{
        name: user?.displayName ?? "Kamal Sharma",
        email: user?.email ?? "demo@nirmalgwalior.in",
        authenticated: Boolean(user),
      }}
    />
  );
}

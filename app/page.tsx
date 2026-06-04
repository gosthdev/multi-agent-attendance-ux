import { cookies } from "next/headers";
import { parseJwt } from "@/lib/cognito";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function HomePage() {
  const cookieStore = await cookies();
  const idToken = cookieStore.get("id_token")?.value;
  
  let user = null;
  if (idToken) {
    user = parseJwt(idToken);
  }

  return <DashboardShell user={user} />;
}

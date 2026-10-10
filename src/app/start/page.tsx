import { redirect } from "next/navigation";
import { homeFor } from "@/lib/access";
import { getViewer } from "@/server/viewer";

/** Where sign-in lands when there is no callback URL: each role has its own home. */
export default async function StartPage() {
  const viewer = await getViewer();
  redirect(viewer ? homeFor(viewer.role) : "/login");
}

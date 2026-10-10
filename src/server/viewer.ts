import { auth } from "@/auth";
import type { Viewer } from "@/lib/types";

export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.role) return null;
  return { id: user.id, role: user.role, name: user.name ?? "", email: user.email ?? "" };
}

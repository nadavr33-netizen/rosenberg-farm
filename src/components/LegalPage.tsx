import Link from "next/link";
import { configured, serverClient } from "@/lib/supabase";
import type { Farm } from "@/lib/types";

export async function getFarm(): Promise<Farm | null> {
  if (!configured) return null;
  const { data } = await serverClient().rpc("get_catalog");
  return data ? (data as { farm: Farm }).farm : null;
}

export function LegalShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="doc" dir="rtl" lang="he">
      <p><Link href="/">← משק רוזנברג</Link></p>
      {children}
    </main>
  );
}

import Shop from "@/components/Shop";
import { configured, serverClient } from "@/lib/supabase";
import type { Catalog } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!configured) {
    return <main className="doc"><h1>משק רוזנברג</h1><p>האתר עוד לא מחובר למסד הנתונים. ראו את SETUP.md.</p></main>;
  }
  const { data, error } = await serverClient().rpc("get_catalog");
  if (error || !data) {
    return <main className="doc"><h1>משק רוזנברג</h1><p>האתר לא זמין כרגע. נסו שוב בעוד כמה דקות.</p></main>;
  }
  return <Shop catalog={data as Catalog} />;
}

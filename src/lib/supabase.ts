import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const configured = Boolean(URL && KEY);

/** Server-side client for the public functions (catalog, order lookup). No user session. */
export function serverClient(): SupabaseClient {
  return createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

let browser: SupabaseClient | null = null;
/** Browser client: customers place orders with it; admins sign in with it. */
export function browserClient(): SupabaseClient {
  if (!browser) browser = createBrowserClient(URL, KEY);
  return browser;
}

export function imageUrl(path?: string | null): string | null {
  if (!path) return null;
  return `${URL}/storage/v1/object/public/product-images/${path}`;
}

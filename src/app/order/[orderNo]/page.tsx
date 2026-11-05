import OrderPage from "@/components/OrderPage";
import { configured, serverClient } from "@/lib/supabase";
import type { OrderView } from "@/lib/types";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Order({ params, searchParams }: {
  params: Promise<{ orderNo: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orderNo } = await params;
  const { t } = await searchParams;
  let order: OrderView | null = null;
  let farm = null;
  if (configured && t && UUID.test(t)) {
    const sb = serverClient();
    const [o, c] = await Promise.all([
      sb.rpc("get_order", { p_order_no: decodeURIComponent(orderNo), p_token: t }),
      sb.rpc("get_catalog"),
    ]);
    order = (o.data as OrderView) || null;
    farm = c.data ? (c.data as { farm: unknown }).farm : null;
  }
  return <OrderPage order={order} farm={farm as never} />;
}

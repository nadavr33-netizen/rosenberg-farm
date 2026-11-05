import type { Cat, PayMethod, Status } from "@/lib/types";

export interface FarmRow {
  id: number; name_he: string; name_en: string; addr_he: string; addr_en: string; dealer_no: string; contact_phone: string;
  bank_benef_he: string; bank_benef_en: string; bank_name_he: string; bank_name_en: string; bank_branch: string; bank_account: string;
  transfer_hold_hours: number; online_payments_enabled: boolean;
}
export interface AreaRow { id: string; name_he: string; name_en: string; fee: number; sort: number; active: boolean }
export interface ProductRow {
  id: string; cat: Cat; name_he: string; name_en: string; unit_he: string; unit_en: string; note_he: string; note_en: string;
  price: number; vat: boolean; image_path: string | null; sort: number; active: boolean;
}
export interface DistRow {
  id: string; type: "pickup" | "delivery"; date: string; time_label: string; name_he: string; name_en: string;
  place_he: string; place_en: string; phone: string; whatsapp: string; area_ids: string[]; active: boolean;
}
export interface StockRow { distribution_id: string; product_id: string; allocated: number }
export interface ItemRow { order_id: string; product_id: string; qty: number; unit_price: number; vat: boolean; name_he: string; name_en: string; unit_he: string; unit_en: string }
export interface OrderRow {
  id: string; order_no: string; distribution_id: string; area_id: string | null; status: Status; pay_method: PayMethod;
  cust_name: string; cust_phone: string; cust_email: string; address: string; city: string; notes: string;
  biz_name: string; biz_id: string; sms_opt_in: boolean; subtotal: number; delivery_fee: number; total: number; vat_amount: number;
  invoice_no: string; hold_until: string | null; created_at: string; paid_at: string | null; closed_at: string | null;
  order_items: ItemRow[];
}
export interface AdminRow { email: string; name: string; phone: string; is_owner: boolean; added_at: string }

export interface AdminData {
  farm: FarmRow; areas: AreaRow[]; products: ProductRow[]; dists: DistRow[]; stock: StockRow[]; orders: OrderRow[]; admins: AdminRow[];
}

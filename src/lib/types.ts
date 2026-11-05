export type Lang = "he" | "en";
export type Cat = "mango" | "avocado" | "tomato" | "oil";
export type PayMethod = "bit" | "paybox" | "transfer";
export type Status = "await" | "paid" | "closed" | "cancelled";

export interface Farm {
  name_he: string; name_en: string; addr_he: string; addr_en: string;
  contact_phone: string;
  dealer_no: string;
  bank_benef_he: string; bank_benef_en: string; bank_name_he: string; bank_name_en: string;
  bank_branch: string; bank_account: string;
  transfer_hold_hours: number;
  online_payments_enabled: boolean;
}
export interface Area { id: string; name_he: string; name_en: string; fee: number; }
export interface Product {
  id: string; cat: Cat; name_he: string; name_en: string; unit_he: string; unit_en: string;
  note_he: string; note_en: string; price: number; vat: boolean; image_path: string | null;
}
export interface Distribution {
  id: string; type: "pickup" | "delivery"; date: string; time_label: string;
  name_he: string; name_en: string; place_he: string; place_en: string;
  phone: string; area_ids: string[];
  avail: Record<string, number>;
}
export interface Catalog { farm: Farm; areas: Area[]; products: Product[]; distributions: Distribution[]; }

export interface OrderView {
  order_no: string; status: Status; pay_method: PayMethod; lang: Lang;
  cust_name: string; address: string; city: string;
  subtotal: number; delivery_fee: number; total: number; vat_amount: number;
  invoice_no: string; hold_until: string | null; created_at: string;
  area: { name_he: string; name_en: string } | null;
  distribution: {
    type: "pickup" | "delivery"; date: string; time_label: string;
    name_he: string; name_en: string; place_he: string; place_en: string; phone: string; whatsapp: string;
  };
  items: { qty: number; unit_price: number; vat: boolean; name_he: string; name_en: string; unit_he: string; unit_en: string }[];
}

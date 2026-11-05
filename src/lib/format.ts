import type { Lang } from "./types";

export const VAT = 0.18;

export function money(n: number, lang: Lang): string {
  const v = Math.round(Number(n) * 100) / 100;
  return "₪" + v.toLocaleString(lang === "he" ? "he-IL" : "en-GB", {
    minimumFractionDigits: v % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function dt(d: string, lang: Lang, o: Intl.DateTimeFormatOptions): string {
  const date = d.length === 10 ? new Date(d + "T12:00:00") : new Date(d);
  return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { timeZone: "Asia/Jerusalem", ...o }).format(date);
}

export const longDate = (d: string, lang: Lang) => dt(d, lang, { weekday: "long", day: "numeric", month: "long" });

export const safeWa = (u?: string | null) => /^https:\/\/(chat\.whatsapp\.com|wa\.me)\/\S+$/.test(String(u || "").trim());

export interface Line { pid: string; q: number; price: number; vat: boolean; sum: number }

/** Totals for a cart. Prices include VAT; only taxable lines and the delivery fee carry VAT. */
export function calc(lines: Line[], fee: number) {
  let exempt = 0, taxable = 0;
  for (const l of lines) l.vat ? (taxable += l.sum) : (exempt += l.sum);
  taxable += fee;
  return { exempt, taxable, fee, vat: taxable - taxable / (1 + VAT), total: exempt + taxable };
}

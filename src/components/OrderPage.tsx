"use client";
import { useState } from "react";
import Link from "next/link";
import type { Farm, OrderView } from "@/lib/types";
import { T, pick } from "@/lib/i18n";
import { dt, longDate, money, safeWa } from "@/lib/format";
import { useLang } from "./useLang";
import Header from "./Header";
import { CLOCK, TICK } from "./icons";

export default function OrderPage({ order, farm }: { order: OrderView | null; farm: Farm | null }) {
  const [lang, setLang] = useLang(order?.lang || "he");
  const t = (k: string) => T[lang][k];
  const [copied, setCopied] = useState(false);
  const farmName = farm ? pick(farm, "name", lang) : T[lang].brand;

  if (!order) {
    return (
      <>
        <Header lang={lang} setLang={setLang} name={farmName} />
        <main className="col"><p className="statusbox bad">{t("notFound")}</p><Link className="primary" href="/" style={{ textAlign: "center", textDecoration: "none" }}>{t("backShop")}</Link></main>
      </>
    );
  }

  const e = order.distribution;
  const awaiting = order.status === "await" && order.pay_method === "transfer";
  const where = e.type === "pickup"
    ? `${pick(e, "name", lang)} · ${pick(e, "place", lang)}`
    : `${t("homeDel")}${order.area ? " · " + pick(order.area, "name", lang) : ""} · ${order.address}, ${order.city}`;
  const holdTxt = order.hold_until ? dt(order.hold_until, lang, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";

  const copy = async () => {
    if (!farm) return;
    const txt = [
      `${t("benef")}: ${pick(farm, "bank_benef", lang)}`, `${t("bankN")}: ${pick(farm, "bank_name", lang)}`,
      `${t("branch")}: ${farm.bank_branch}`, `${t("acct")}: ${farm.bank_account}`,
      `${t("amt")}: ${money(order.total, lang)}`, `${t("ref")}: ${order.order_no}`,
    ].join("\n");
    try { await navigator.clipboard.writeText(txt); setCopied(true); } catch { /* the details stay visible to copy by hand */ }
  };

  const status = order.status === "cancelled" ? <p className="statusbox bad">{t("opCancelled")}</p>
    : order.status === "closed" ? <p className="statusbox ok">{t("opClosed")}</p>
    : order.status === "paid" ? <p className="statusbox ok">{t("opPaid")}</p> : null;

  return (
    <>
      <Header lang={lang} setLang={setLang} name={farmName} />
      <main className="col">
        <div className="done">
          <div className={`tick ${awaiting ? "wait" : ""}`}>{awaiting ? CLOCK : TICK}</div>
          <h1>{awaiting ? t("doneTrT") : t("doneT")}</h1>
          <p className="num"><b style={{ color: "var(--ink)" }}>{t("ord")}: {order.order_no}</b></p>
          {e.type === "pickup" && e.phone ? (
            <p>{t("contactAt")(pick(e, "name", lang))} <b dir="ltr" className="num" style={{ color: "var(--ink)" }}>{e.phone}</b></p>
          ) : null}
          {e.type === "pickup" && safeWa(e.whatsapp) ? (
            <a className="walink" href={e.whatsapp} target="_blank" rel="noopener noreferrer">{t("waJoin")}</a>
          ) : null}
        </div>

        {status}

        {awaiting && farm ? (
          <div className="bank">
            <b>{t("bankT")}</b>
            <p className="hint">{t("holdUntil")(holdTxt)} {t("invoiceLater")}</p>
            <dl className="num">
              <div><dt>{t("benef")}</dt><dd>{pick(farm, "bank_benef", lang)}</dd></div>
              <div><dt>{t("bankN")}</dt><dd>{pick(farm, "bank_name", lang)}</dd></div>
              <div><dt>{t("branch")}</dt><dd>{farm.bank_branch}</dd></div>
              <div><dt>{t("acct")}</dt><dd>{farm.bank_account}</dd></div>
              <div><dt>{t("amt")}</dt><dd>{money(order.total, lang)}</dd></div>
              <div><dt>{t("ref")}</dt><dd><b>{order.order_no}</b></dd></div>
            </dl>
            <button className="ghost" onClick={copy}>{copied ? t("copied") : t("copy")}</button>
          </div>
        ) : null}

        <div className="slot"><div><b>{where}</b><span className="num">{longDate(e.date, lang)} · <span dir="ltr">{e.time_label}</span></span></div></div>

        <div className="sum">
          <table className="num"><tbody>
            {order.items.map((i, n) => (
              <tr key={n}><td>{i.qty} × {pick(i, "name", lang)} · {pick(i, "unit", lang)}</td><td>{money(i.unit_price * i.qty, lang)}</td></tr>
            ))}
            {Number(order.delivery_fee) ? <tr><td>{t("delFee")}</td><td>{money(order.delivery_fee, lang)}</td></tr> : null}
            <tr className="tot"><td>{t("total")}</td><td>{money(order.total, lang)}</td></tr>
            <tr className="sub"><td>{t("vatIncl")}</td><td>{money(order.vat_amount, lang)}</td></tr>
            {order.invoice_no ? <tr className="sub"><td>{t("inv")}</td><td>{order.invoice_no}</td></tr> : null}
          </tbody></table>
        </div>
        <p className="hint">{t("keepLink")}</p>
        <Link href="/" className="link" style={{ alignSelf: "flex-start" }}>{t("orderAgain")}</Link>
      </main>
    </>
  );
}

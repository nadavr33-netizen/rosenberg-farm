"use client";
import { useState } from "react";
import type { Lang } from "@/lib/types";
import { T, pick } from "@/lib/i18n";
import { dt, money } from "@/lib/format";
import { browserClient } from "@/lib/supabase";
import type { AdminData, DistRow, OrderRow } from "./types";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

export default function OrdersTab({ data, lang, reload }: { data: AdminData; lang: Lang; reload: () => Promise<void> }) {
  const sb = browserClient();
  const t = (k: string) => T[lang][k];
  const { dists, products, areas, stock, orders } = data;
  const [filter, setFilter] = useState<string>("all");
  const [showCancelled, setShowCancelled] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [x, setX] = useState<{ by: "loc" | "date"; loc: string; date: string }>({ by: "loc", loc: "all", date: "all" });

  const D = Object.fromEntries(dists.map((d) => [d.id, d]));
  const A = Object.fromEntries(areas.map((a) => [a.id, a]));
  const P = Object.fromEntries(products.map((p) => [p.id, p]));
  const live = orders.filter((o) => o.status !== "cancelled");
  const sold = (did: string, pid: string) =>
    live.filter((o) => o.distribution_id === did).reduce((s, o) => s + (o.order_items.find((i) => i.product_id === pid)?.qty || 0), 0);
  const alloc = (did: string, pid: string) => stock.find((s) => s.distribution_id === did && s.product_id === pid)?.allocated || 0;
  const distName = (d: DistRow) => (d.type === "pickup" ? pick(d, "name", lang) : `${t("homeDel")} · ${d.area_ids.map((a) => (A[a] ? pick(A[a], "name", lang) : "")).join(", ")}`);

  const list = orders.filter((o) => (showCancelled || o.status !== "cancelled") && (filter === "all" || o.distribution_id === filter));
  const inScope = live.filter((o) => filter === "all" || o.distribution_id === filter);
  const paidSum = inScope.filter((o) => o.status !== "await").reduce((s, o) => s + Number(o.total), 0);
  const awaitList = inScope.filter((o) => o.status === "await");
  const awaitSum = awaitList.reduce((s, o) => s + Number(o.total), 0);
  const scopeDists = filter === "all" ? dists.filter((d) => d.active) : [D[filter]].filter(Boolean);
  let allocTotal = 0, soldTotal = 0;
  scopeDists.forEach((d) => stock.filter((s) => s.distribution_id === d.id).forEach((s) => { allocTotal += s.allocated; soldTotal += sold(d.id, s.product_id); }));

  const act = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setNote(null);
    const { error } = await fn();
    if (error) setNote({ ok: false, text: `${t("saveErr")} (${error.message})` });
    await reload();
  };
  const setStatus = (o: OrderRow, status: OrderRow["status"]) => act(() => sb.from("orders").update({
    status,
    ...(status === "paid" && !o.paid_at ? { paid_at: new Date().toISOString() } : {}),
    ...(status === "closed" ? { closed_at: new Date().toISOString() } : {}),
  }).eq("id", o.id));
  const setInvoice = (o: OrderRow, v: string) => { if (v !== o.invoice_no) act(() => sb.from("orders").update({ invoice_no: v.trim() }).eq("id", o.id)); };
  const setAlloc = async (did: string, pid: string, v: number) => {
    const s = sold(did, pid);
    if (!(v >= s)) { setNote({ ok: false, text: t("allocBelowSold") }); return; }
    await act(() => sb.from("stock").upsert({ distribution_id: did, product_id: pid, allocated: Math.round(v) }));
  };

  // ---------- CSV ----------
  const exportList = () => orders
    .filter((o) => o.status !== "cancelled" && D[o.distribution_id])
    .filter((o) => (x.by === "loc" ? x.loc === "all" || o.distribution_id === x.loc : x.date === "all" || D[o.distribution_id].date === x.date))
    .sort((a, b) => D[a.distribution_id].date.localeCompare(D[b.distribution_id].date) || a.distribution_id.localeCompare(b.distribution_id) || a.order_no.localeCompare(b.order_no));
  const download = () => {
    const rows = exportList();
    if (!rows.length) return;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const pids = products.map((p) => p.id).filter((pid) => rows.some((o) => o.order_items.some((i) => i.product_id === pid)));
    const head = [...(t("csvH") as string[]), ...pids.map((pid) => `${pick(P[pid], "name", lang)} ${pick(P[pid], "unit", lang)}`), ...(t("csvT") as string[])];
    const tot: Record<string, number> = Object.fromEntries(pids.map((p) => [p, 0]));
    let tFee = 0, tSum = 0, tVat = 0;
    const body = rows.map((o) => {
      const d = D[o.distribution_id];
      const q = (pid: string) => o.order_items.find((i) => i.product_id === pid)?.qty || 0;
      pids.forEach((p) => (tot[p] += q(p)));
      tFee += Number(o.delivery_fee); tSum += Number(o.total); tVat += Number(o.vat_amount);
      const place = d.type === "pickup" ? pick(d, "place", lang) : o.area_id && A[o.area_id] ? pick(A[o.area_id], "name", lang) : "";
      const st = o.status === "await" ? t("st_await") : o.status === "closed" ? (d.type === "pickup" ? t("st_col") : t("st_del")) : t("st_paid");
      return [o.order_no, d.date, d.time_label, distName(d), place, d.type === "pickup" ? d.phone : "", d.type === "pickup" ? t("tPick") : t("tDel"),
        o.cust_name, o.cust_phone, o.cust_email, d.type === "delivery" ? o.address : "", d.type === "delivery" ? o.city : "", o.notes, o.biz_name, o.biz_id,
        ...pids.map(q), r2(Number(o.delivery_fee)), r2(Number(o.total)), r2(Number(o.vat_amount)), t(o.pay_method), st, o.invoice_no];
    });
    body.push([t("csvTotal"), ...Array((t("csvH") as string[]).length - 1).fill(""), ...pids.map((p) => tot[p]), r2(tFee), r2(tSum), r2(tVat), "", "", ""]);
    const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = "﻿" + [head, ...body].map((r) => r.map(esc).join(",")).join("\r\n");
    let tag = "all";
    if (x.by === "loc" && x.loc !== "all") tag = `${D[x.loc].date}-${(D[x.loc].name_en || D[x.loc].id).replace(/[^A-Za-z0-9]+/g, "-")}`;
    else if (x.by === "date" && x.date !== "all") tag = x.date;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `rosenberg-orders-${tag}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const dates = [...new Set(dists.map((d) => d.date))].sort().reverse();
  const exportCount = exportList().length;

  const td = today();
  const cards = [...dists].filter((d) => d.active || orders.some((o) => o.distribution_id === d.id))
    .sort((a, b) => (a.date >= td) === (b.date >= td) ? (a.date >= td ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) : a.date >= td ? -1 : 1);
  const sel = filter !== "all" ? D[filter] : null;
  const selProducts = sel ? products.filter((p) => p.active || alloc(sel.id, p.id) > 0) : [];

  return (
    <>
      <div className="adm-head"><div className="lead"><h1>{t("aTitle")}</h1><p>{t("aLead")}</p></div></div>
      {note ? <p className={`note ${note.ok ? "ok" : "bad"}`} role="status">{note.text}</p> : null}

      <div className="kpis num">
        <div className="kpi"><span>{t("kOrders")}</span><b>{inScope.length}</b></div>
        <div className="kpi"><span>{t("kPaid")}</span><b>{money(paidSum, lang)}</b><small>{t("ordersN")(inScope.length - awaitList.length)}</small></div>
        <div className={`kpi ${awaitList.length ? "att" : ""}`}><span>{t("kAwait")}</span><b>{money(awaitSum, lang)}</b><small>{t("ordersN")(awaitList.length)}</small></div>
        <div className="kpi"><span>{t("kUnits")}</span><b>{soldTotal}</b><small>{t("ofAlloc")(allocTotal)}</small></div>
      </div>

      <section className="sec">
        <h2>{t("dists")}</h2>
        <div className="evgrid">
          <button className="evc" aria-pressed={filter === "all"} onClick={() => setFilter("all")}><b>{t("all")}</b><div className="k"><span>{t("ordersN")(live.length)}</span></div></button>
          {cards.map((d) => {
            let a = 0, s = 0;
            stock.filter((r) => r.distribution_id === d.id).forEach((r) => { a += r.allocated; s += sold(d.id, r.product_id); });
            const n = live.filter((o) => o.distribution_id === d.id).length;
            return (
              <button key={d.id} className="evc" aria-pressed={filter === d.id} onClick={() => { setFilter(d.id); setX({ ...x, by: "loc", loc: d.id }); }} style={d.date < td ? { opacity: 0.6 } : undefined}>
                <b>{distName(d)}</b>
                <div className="k num"><span>{dt(d.date, lang, { weekday: "short", day: "numeric", month: "short" })}{d.date < td ? ` · ${t("past")}` : ""}</span><span>{t("ordersN")(n)}</span></div>
                <div className="bar"><i style={{ width: `${a ? Math.round((s / a) * 100) : 0}%` }} /></div>
                <div className="k num"><span>{s} / {a}</span><span>{d.type === "pickup" ? pick(d, "place", lang) : ""}</span></div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sec">
        <h2>{sel ? `${t("packFor")}${distName(sel)} · ${dt(sel.date, lang, { day: "numeric", month: "short" })}` : t("pack")}</h2>
        {!sel ? <p className="hint">{t("pickAll")}</p> : (
          <div className="tbl"><table className="num"><thead><tr><th>{t("prod")}</th><th className="n">{t("sold")}</th><th className="n">{t("alloc")}</th><th className="n">{t("remain")}</th><th /></tr></thead>
            <tbody>
              {selProducts.map((p) => {
                const s = sold(sel.id, p.id), a = alloc(sel.id, p.id);
                return (
                  <tr key={p.id}>
                    <td>{pick(p, "name", lang)} · {pick(p, "unit", lang)}</td>
                    <td className="n"><b>{s}</b></td>
                    <td className="n"><input type="number" min={s} defaultValue={a} key={`${sel.id}-${p.id}-${a}`} id={`al-${sel.id}-${p.id}`} aria-label={t("alloc")}
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== a) setAlloc(sel.id, p.id, v); }} /></td>
                    <td className="n">{a - s}</td>
                    <td><div className={`bar mini ${a - s < a * 0.25 ? "low" : ""}`}><i style={{ width: `${a ? Math.round((s / a) * 100) : 0}%` }} /></div></td>
                  </tr>
                );
              })}
            </tbody></table></div>
        )}
      </section>

      <section className="sec">
        <h2>{t("expT")}</h2>
        <div className="card">
          <div className="grid2">
            <label className="cf"><span>{t("expBy")}</span>
              <select className="ci" id="x-by" value={x.by} onChange={(e) => setX({ ...x, by: e.target.value as "loc" | "date" })}>
                <option value="loc">{t("expLoc")}</option><option value="date">{t("expDate")}</option>
              </select></label>
            {x.by === "loc" ? (
              <label className="cf"><span>{t("dist")}</span>
                <select className="ci" id="x-loc" value={x.loc} onChange={(e) => setX({ ...x, loc: e.target.value })}>
                  <option value="all">{t("expAll")}</option>
                  {cards.map((d) => <option key={d.id} value={d.id}>{distName(d)} · {dt(d.date, lang, { day: "numeric", month: "short" })}</option>)}
                </select></label>
            ) : (
              <label className="cf"><span>{t("cfgDate")}</span>
                <select className="ci" id="x-date" value={x.date} onChange={(e) => setX({ ...x, date: e.target.value })}>
                  <option value="all">{t("expAll")}</option>
                  {dates.map((d) => <option key={d} value={d}>{dt(d, lang, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</option>)}
                </select></label>
            )}
          </div>
          <div className="cardfoot"><span className="left num">{t("ordersN")(exportCount)}</span><button className="primary" onClick={download} disabled={!exportCount}>{t("expBtn")}</button></div>
        </div>
      </section>

      <section className="sec">
        <div className="cardfoot" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{t("ordT")}</h2>
          <label className="chk"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> {t("showCancelled")}</label>
        </div>
        <div className="tbl"><table>
          <thead><tr><th>#</th><th>{t("cust")}</th><th>{t("dist")}</th><th>{t("items")}</th><th className="n">{t("sum")}</th><th>{t("inv")}</th><th>{t("status")}</th></tr></thead>
          <tbody>
            {list.length ? list.map((o) => {
              const d = D[o.distribution_id];
              return (
                <tr key={o.id}>
                  <td className="num"><b>{o.order_no}</b><br /><span className="left">{dt(o.created_at, lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></td>
                  <td>{o.cust_name}<br /><span className="left num" dir="ltr">{o.cust_phone}</span><br /><span className="left" dir="ltr">{o.cust_email}</span>
                    {d?.type === "delivery" ? <><br /><span className="left">{o.address}, {o.city}</span></> : null}
                    {o.notes ? <><br /><span className="left">“{o.notes}”</span></> : null}
                    {o.biz_name ? <><br /><span className="left">{o.biz_name} {o.biz_id}</span></> : null}</td>
                  <td>{d ? distName(d) : o.distribution_id}<br /><span className="left">{d ? dt(d.date, lang, { day: "numeric", month: "short" }) : ""}</span></td>
                  <td>{o.order_items.map((i) => (<div key={i.product_id}>{i.qty}× {pick(i, "name", lang)} <span className="left">{pick(i, "unit", lang)}</span></div>))}</td>
                  <td className="n num">{money(Number(o.total), lang)}<br /><span className="left">{t(o.pay_method)}</span></td>
                  <td><input className="inv" defaultValue={o.invoice_no} key={`${o.id}-${o.invoice_no}`} placeholder={t("invPh")} dir="ltr" onBlur={(e) => setInvoice(o, e.target.value)} disabled={o.status === "cancelled"} /></td>
                  <td>
                    <div className="stk">
                      {o.status === "await" ? (<>
                        <span className="pill await">{t("st_await")}</span>
                        <button className="pill confirm" onClick={() => setStatus(o, "paid")}>{t("confirm")}</button>
                        {confirmCancel === o.id
                          ? <span className="rowacts"><button className="link danger" onClick={() => { setConfirmCancel(null); setStatus(o, "cancelled"); }}>{t("confirmDel")}</button><button className="link" onClick={() => setConfirmCancel(null)}>{t("admKeep")}</button></span>
                          : <button className="link danger" onClick={() => setConfirmCancel(o.id)}>{t("cancelOrder")}</button>}
                      </>) : o.status === "paid" ? (<>
                        <span className="pill paid">{t("st_paid")}</span>
                        <button className="pill confirm" onClick={() => setStatus(o, "closed")}>{d?.type === "delivery" ? t("st_del") : t("st_col")} ✓</button>
                      </>) : o.status === "closed" ? (<>
                        <span className="pill closed">{d?.type === "delivery" ? t("st_del") : t("st_col")}</span>
                        <button className="link" onClick={() => setStatus(o, "paid")}>{t("undo")}</button>
                      </>) : <span className="pill cancelled">{t("st_cancelled")}</span>}
                    </div>
                  </td>
                </tr>
              );
            }) : <tr><td colSpan={7} className="empty">{t("none")}</td></tr>}
          </tbody>
        </table></div>
      </section>
    </>
  );
}

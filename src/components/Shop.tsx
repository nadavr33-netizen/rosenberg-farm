"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Catalog, Distribution, PayMethod } from "@/lib/types";
import { T, pick } from "@/lib/i18n";
import { calc, dt, longDate, money, type Line } from "@/lib/format";
import { browserClient, imageUrl } from "@/lib/supabase";
import { useLang } from "./useLang";
import Header from "./Header";
import { CatIcon, LOCK } from "./icons";

type Step = "welcome" | "produce" | "where" | "pay";
const CATS = ["mango", "avocado", "tomato", "oil"] as const;

interface Details {
  name: string; phone: string; email: string; address: string; city: string; notes: string;
  biz: boolean; bizName: string; bizId: string; sms: boolean;
}

export default function Shop({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const [lang, setLang] = useLang();
  const t = (k: string) => T[lang][k];
  const { farm, areas, products, distributions } = catalog;

  const [step, setStep] = useState<Step>("welcome");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [area, setArea] = useState<string | null>(null);
  const [evId, setEvId] = useState<string | null>(null);
  const [pay, setPay] = useState<PayMethod>("transfer");
  const [d, setD] = useState<Details>({ name: "", phone: "", email: "", address: "", city: "", notes: "", biz: false, bizName: "", bizId: "", sms: true });
  const [showNotes, setShowNotes] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const P = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const A = useMemo(() => Object.fromEntries(areas.map((a) => [a.id, a])), [areas]);
  const EV = useMemo(() => Object.fromEntries(distributions.map((e) => [e.id, e])), [distributions]);
  const ev = evId ? EV[evId] : null;

  const leftOf = (e: Distribution, pid: string) => e.avail[pid] || 0;
  const maxLeft = (pid: string) => Math.max(0, ...distributions.map((e) => leftOf(e, pid)));
  const firstDate = (pid: string) => distributions.filter((e) => leftOf(e, pid) > 0).map((e) => e.date).sort()[0];
  const shown = products.filter((p) => distributions.some((e) => leftOf(e, p.id) > 0));
  const missing = (e: Distribution) => Object.keys(cart).filter((pid) => cart[pid] > 0 && leftOf(e, pid) < cart[pid]);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const evName = (e: Distribution) => (e.type === "pickup" ? pick(e, "name", lang) : t("homeDel"));
  const evPlace = (e: Distribution) =>
    e.type === "pickup" ? pick(e, "place", lang) : e.area_ids.map((a) => (A[a] ? pick(A[a], "name", lang) : "")).filter(Boolean).join(" · ");

  const lines: Line[] = Object.entries(cart)
    .filter(([pid, q]) => q > 0 && P[pid])
    .map(([pid, q]) => ({ pid, q, price: Number(P[pid].price), vat: P[pid].vat, sum: Number(P[pid].price) * q }));
  const fee = ev && ev.type === "delivery" && area && A[area] ? Number(A[area].fee) : 0;
  const totals = calc(lines, fee);

  const go = (s: Step) => { setStep(s); setErr(""); window.scrollTo({ top: 0 }); };
  const inc = (pid: string) => setCart((c) => ({ ...c, [pid]: Math.min(maxLeft(pid), (c[pid] || 0) + 1) }));
  const dec = (pid: string) => setCart((c) => ({ ...c, [pid]: Math.max(0, (c[pid] || 0) - 1) }));
  const set = (k: keyof Details, v: string | boolean) => setD((x) => ({ ...x, [k]: v }));

  const stepsBar = () => {
    const idx = { produce: 0, where: 1, pay: 2, welcome: -1 }[step];
    return (
      <ol className="steps">
        {(t("steps") as string[]).map((s, i) => (
          <li key={s} className={i === idx ? "on" : i < idx ? "done" : ""}>{s}</li>
        ))}
      </ol>
    );
  };

  const slot = (onChange: () => void) => {
    if (!ev) return null;
    const where = ev.type === "pickup"
      ? `${evName(ev)} · ${evPlace(ev)}`
      : `${t("homeDel")} · ${area && A[area] ? pick(A[area], "name", lang) : ""} · ${t("fee")} ${money(fee, lang)}`;
    return (
      <div className="slot">
        <div>
          <b>{where}</b>
          <span className="num">{longDate(ev.date, lang)} · <span dir="ltr">{ev.time_label}</span></span>
          {ev.type === "pickup" && ev.phone ? (
            <span className="evphone">{t("contact")}: <span dir="ltr" className="num">{ev.phone}</span></span>
          ) : null}
        </div>
        <button type="button" className="link" onClick={onChange}>{t("change")}</button>
      </div>
    );
  };

  const cartBar = (label: string, onClick: () => void, disabled: boolean) => (
    <div className="cartbar">
      <div className="cartbar-in">
        <div>
          <b className="num">{money(count ? totals.total : 0, lang)}</b>
          {t("units")(count)}
          {fee && count ? ` · ${t("fee")} ${money(fee, lang)}` : ""}
        </div>
        <button className="primary" onClick={onClick} disabled={disabled}>{label}</button>
      </div>
    </div>
  );

  // ---------- Welcome ----------
  const welcome = () => {
    const next = [...distributions].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    return (
      <>
        <section className="hero">
          <div className="hero-logo"><span className="badge"><img src="/logo.webp" alt={pick(farm, "name", lang)} /></span></div>
          <p>{t("wLead")}</p>
          {distributions.length ? (
            <button className="primary wide" onClick={() => go("produce")}>{t("wCta")}</button>
          ) : (
            <p className="statusbox bad">{t("noDists")}</p>
          )}
          <div className="fields" aria-hidden="true" />
        </section>
        <section>
          <h2 className="h2s">{t("wHow")}</h2>
          <ol className="how">
            {(t("wSteps") as string[][]).map((s) => (<li key={s[0]}><b>{s[0]}</b><span>{s[1]}</span></li>))}
          </ol>
        </section>
        {next.length ? (
          <section>
            <h2 className="h2s">{t("wNext")}</h2>
            <div className="nextlist">
              {next.map((e) => (
                <div className="nx" key={e.id}>
                  <span className="num">{dt(e.date, lang, { weekday: "short", day: "numeric", month: "short" })}</span>
                  <b>{evName(e)}</b>
                  <span>{evPlace(e)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </>
    );
  };

  // ---------- Produce ----------
  const produce = () => {
    const first = distributions.map((e) => e.date).sort()[0];
    return (
      <>
        {stepsBar()}
        <div className="lead"><h1>{t("prodTitle")}</h1><p>{t("prodLead")}</p></div>
        <div className="prods">
          {CATS.map((cat) => {
            const ids = shown.filter((p) => p.cat === cat);
            if (!ids.length) return null;
            return (
              <section className="pgroup" key={cat}>
                <h2 className="pcat"><CatIcon cat={cat} /><span>{t("catName")[cat]}</span></h2>
                <div className="plist">
                  {ids.map((p) => {
                    const left = maxLeft(p.id), q = cart[p.id] || 0, fd = firstDate(p.id), img = imageUrl(p.image_path);
                    return (
                      <div key={p.id} className={`prow${left === 0 ? " out" : ""}${q ? " on" : ""}`}>
                        {img ? (
                          <button type="button" className="pthumb" onClick={() => setZoom(p.id)} aria-label={pick(p, "name", lang)}>
                            <img src={img} alt="" loading="lazy" />
                          </button>
                        ) : null}
                        <div className="pmain">
                          <div className="pname">
                            <b>{pick(p, "name", lang)}</b> <span>· {pick(p, "unit", lang)}</span>
                            {fd && first && fd > first ? <> <span className="tag soon">{t("from")(dt(fd, lang, { day: "numeric", month: "short" }))}</span></> : null}
                          </div>
                          <div className="pnote">{pick(p, "note", lang)}</div>
                          <div className="pmeta num"><b>{money(Number(p.price), lang)}</b>{left ? "" : ` · ${t("soldOut")}`}</div>
                        </div>
                        {left ? (
                          <div className="step">
                            <button onClick={() => dec(p.id)} disabled={q === 0} aria-label="−">−</button>
                            <output className="num">{q}</output>
                            <button onClick={() => inc(p.id)} disabled={q >= left} aria-label="+">+</button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        {cartBar(t("next"), () => go("where"), count === 0)}
      </>
    );
  };

  // ---------- Delivery + details ----------
  const evCard = (e: Distribution) => {
    const miss = missing(e);
    const total = Object.values(e.avail).reduce((a, b) => a + b, 0);
    const off = total === 0 || miss.length > 0;
    const day = new Date(e.date + "T12:00:00");
    const feeTxt = e.type === "delivery" && area && A[area] ? ` · ${t("fee")} ${money(Number(A[area].fee), lang)}` : "";
    return (
      <button key={e.id} type="button" className="ev" onClick={() => { setEvId(e.id); setErr(""); }} aria-pressed={evId === e.id} disabled={off}>
        <div className="cal"><small>{dt(e.date, lang, { weekday: "short" })}</small><b className="num">{day.getDate()}</b></div>
        <div className="ev-main">
          <h3>{evName(e)}</h3>
          <p>{e.type === "pickup" ? evPlace(e) : longDate(e.date, lang)} · <span className="num" dir="ltr" style={{ whiteSpace: "nowrap" }}>{e.time_label}</span>{feeTxt}</p>
          {e.type === "pickup" && e.phone ? <p className="evphone">{t("contact")}: <span dir="ltr" className="num">{e.phone}</span></p> : null}
          {miss.length ? (
            <div className="left miss">{t("missing")}: {miss.map((pid) => pick(P[pid], "name", lang)).join(", ")}</div>
          ) : total === 0 ? <div className="left num">{t("soldOut")}</div> : null}
        </div>
        <span className="go" />
      </button>
    );
  };

  const field = (k: keyof Details, type = "text", extra: Record<string, string> = {}) => (
    <label>
      {t(k)}
      <input id={`f-${k}`} type={type} value={String(d[k])} onChange={(e) => set(k, e.target.value)} {...extra} />
    </label>
  );

  const submitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ev) return setErr(t("reqEv"));
    if (missing(ev).length) return setErr(t("reqStock"));
    if (!d.name.trim() || !d.phone.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) return setErr(t("req"));
    if (ev.type === "delivery" && (!d.address.trim() || !d.city.trim())) return setErr(t("reqAddr"));
    go("pay");
  };

  const where = () => {
    const chosen = ev && ev.type === method ? ev : null;
    let list: React.ReactNode = null;
    if (chosen) list = slot(() => setEvId(null));
    else if (method === "pickup") list = <div className="events">{distributions.filter((e) => e.type === "pickup").map(evCard)}</div>;
    else list = (
      <>
        <div>
          <p className="hint" style={{ marginBottom: 8, fontWeight: 700, color: "var(--ink)" }}>{t("area")}</p>
          <div className="chips">
            {areas.filter((a) => distributions.some((e) => e.type === "delivery" && e.area_ids.includes(a.id))).map((a) => (
              <button key={a.id} type="button" className="chip" aria-pressed={area === a.id} onClick={() => { setArea(a.id); setEvId(null); }}>
                {pick(a, "name", lang)} <em className="num">{money(Number(a.fee), lang)}</em>
              </button>
            ))}
          </div>
        </div>
        {area ? <div className="events">{distributions.filter((e) => e.type === "delivery" && e.area_ids.includes(area)).map(evCard)}</div> : null}
      </>
    );
    const del = method === "delivery";
    return (
      <>
        {stepsBar()}
        <div className="lead"><h1>{t("whereTitle")}</h1><p>{t("whereLead")}</p></div>
        {chosen ? null : (
          <div className="choice compact">
            <button type="button" aria-pressed={method === "pickup"} onClick={() => { setMethod("pickup"); setEvId(null); }}><b>{t("pickup")}</b><span>{t("pickupSub")}</span></button>
            <button type="button" aria-pressed={method === "delivery"} onClick={() => { setMethod("delivery"); setEvId(null); }}><b>{t("delivery")}</b><span>{t("deliverySub")}</span></button>
          </div>
        )}
        {list}
        <form className="f" onSubmit={submitDetails} noValidate>
          <h2 className="h2s">{t("detTitle")}</h2>
          {field("name", "text", { autoComplete: "name" })}
          <div className="two">
            {field("phone", "tel", { autoComplete: "tel", dir: "ltr" })}
            {field("email", "email", { autoComplete: "email", dir: "ltr" })}
          </div>
          {del ? <div className="two">{field("address", "text", { autoComplete: "street-address" })}{field("city")}</div> : null}
          {showNotes || d.notes ? (
            <label>{t("notes")}<textarea id="f-notes" value={d.notes} placeholder={t("notesPh")} onChange={(e) => set("notes", e.target.value)} /></label>
          ) : (
            <button type="button" className="link" style={{ alignSelf: "flex-start" }} onClick={() => setShowNotes(true)}>{t("addNote")}</button>
          )}
          <label className="chk"><input id="f-biz" type="checkbox" checked={d.biz} onChange={(e) => set("biz", e.target.checked)} /> {t("biz")}</label>
          {d.biz ? <div className="two">{field("bizName")}{field("bizId", "text", { inputMode: "numeric", dir: "ltr" })}</div> : null}
          <label className="chk"><input id="f-sms" type="checkbox" checked={d.sms} onChange={(e) => set("sms", e.target.checked)} /> {t("sms")}</label>
          {err ? <p className="err" role="alert">{err}</p> : null}
          <div className="row">
            <button type="button" className="link" onClick={() => go("produce")}>{t("back")}</button>
            <span style={{ flex: 1 }} />
            <button className="primary" type="submit">{t("toPay")(money(totals.total, lang))}</button>
          </div>
        </form>
      </>
    );
  };

  // ---------- Payment ----------
  const placeOrder = async () => {
    if (!ev || busy) return;
    setBusy(true); setErr("");
    const items: Record<string, number> = {};
    lines.forEach((l) => (items[l.pid] = l.q));
    const { data, error } = await browserClient().rpc("place_order", {
      payload: {
        distribution_id: ev.id, area_id: ev.type === "delivery" ? area : null, pay_method: pay, lang, items,
        customer: { name: d.name, phone: d.phone, email: d.email, address: d.address, city: d.city, notes: d.notes,
          biz_name: d.biz ? d.bizName : "", biz_id: d.biz ? d.bizId : "", sms_opt_in: d.sms },
      },
    });
    if (error || !data) {
      const m = error?.message || "";
      setErr(m.startsWith("out_of_stock") ? t("errStock") : m.includes("distribution_unavailable") || m.includes("area_unavailable") ? t("errDist")
        : m.includes("payment_method") ? t("errPay") : m.includes("details_required") ? t("errDetails") : m.includes("address_required") ? t("errAddress") : t("errGeneric"));
      setBusy(false);
      if (m.startsWith("out_of_stock") || m.includes("unavailable")) router.refresh();
      return;
    }
    const r = data as { order_no: string; token: string };
    router.push(`/order/${encodeURIComponent(r.order_no)}?t=${r.token}`);
  };

  const payView = () => {
    const online = farm.online_payments_enabled;
    return (
      <>
        {stepsBar()}
        {slot(() => go("where"))}
        <div>
          <p className="cat" style={{ margin: "0 0 8px" }}>{t("summary")}</p>
          <div className="sum">
            <table className="num"><tbody>
              {lines.map((l) => (
                <tr key={l.pid}><td>{l.q} × {pick(P[l.pid], "name", lang)} · {pick(P[l.pid], "unit", lang)}</td><td>{money(l.sum, lang)}</td></tr>
              ))}
              {fee ? <tr><td>{t("delFee")} · {area && A[area] ? pick(A[area], "name", lang) : ""}</td><td>{money(fee, lang)}</td></tr> : null}
              <tr className="tot"><td>{t("total")}</td><td>{money(totals.total, lang)}</td></tr>
              <tr className="sub"><td>{t("vatIncl")}</td><td>{money(totals.vat, lang)}</td></tr>
            </tbody></table>
          </div>
        </div>
        <div>
          <p className="cat" style={{ margin: "0 0 8px" }}>{t("method")}</p>
          <div className="choice three compact">
            {(["bit", "paybox", "transfer"] as PayMethod[]).map((m) => {
              const off = m !== "transfer" && !online;
              return (
                <button key={m} type="button" aria-pressed={pay === m} disabled={off} onClick={() => setPay(m)}>
                  <b>{t(m)}</b>
                  {off ? <em>{t("payComingSoon")}</em> : <span>{t(m + "Sub")}</span>}
                </button>
              );
            })}
          </div>
        </div>
        {pay === "transfer" ? (
          <div className="bank">
            <b>{t("bankT")}</b>
            <p className="hint">{t("bankB").replace("24", String(farm.transfer_hold_hours))}</p>
            <dl className="num">
              <div><dt>{t("benef")}</dt><dd>{pick(farm, "bank_benef", lang)}</dd></div>
              <div><dt>{t("bankN")}</dt><dd>{pick(farm, "bank_name", lang)}</dd></div>
              <div><dt>{t("branch")}</dt><dd>{farm.bank_branch}</dd></div>
              <div><dt>{t("acct")}</dt><dd>{farm.bank_account}</dd></div>
              <div><dt>{t("amt")}</dt><dd>{money(totals.total, lang)}</dd></div>
              <div><dt>{t("ref")}</dt><dd><span className="left">{t("refNext")}</span></dd></div>
            </dl>
          </div>
        ) : (
          <div className="secure">{LOCK}<b>{t("appT")(t(pay))}</b></div>
        )}
        <p className="terms">
          {t("termsPre")}<Link href="/terms" target="_blank">{t("termsLink")}</Link>{t("and")}<Link href="/privacy" target="_blank">{t("privacyLink")}</Link>.
        </p>
        {err ? <p className="err" role="alert">{err}</p> : null}
        <div className="row">
          <button className="link" onClick={() => go("where")}>{t("back")}</button>
          <span style={{ flex: 1 }} />
          <button className="primary" onClick={placeOrder} disabled={busy}>
            {busy ? t("placing") : pay === "transfer" ? t("payTr") : t("pay")(t(pay), money(totals.total, lang))}
          </button>
        </div>
      </>
    );
  };

  const zp = zoom ? P[zoom] : null;
  const zimg = zp ? imageUrl(zp.image_path) : null;

  return (
    <>
      <Header lang={lang} setLang={setLang} name={pick(farm, "name", lang)} />
      <main className="col">
        {step === "welcome" ? welcome() : step === "produce" ? produce() : step === "where" ? where() : payView()}
      </main>
      <footer className="foot">
        <Link href="/terms">{t("termsLink")}</Link>
        <Link href="/privacy">{t("privacyLink")}</Link>
        {farm.contact_phone ? <span dir="ltr">{farm.contact_phone}</span> : null}
      </footer>
      {zp && zimg ? (
        <div className="zoom" role="dialog" aria-label={pick(zp, "name", lang)} onClick={() => setZoom(null)}>
          <figure>
            <img src={zimg} alt={pick(zp, "name", lang)} />
            <figcaption>{pick(zp, "name", lang)} · {pick(zp, "unit", lang)} · {money(Number(zp.price), lang)}</figcaption>
            <button type="button" className="ghost">{t("close")}</button>
          </figure>
        </div>
      ) : null}
    </>
  );
}


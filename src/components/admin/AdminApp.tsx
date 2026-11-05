"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { browserClient, configured } from "@/lib/supabase";
import { T } from "@/lib/i18n";
import { useLang } from "../useLang";
import Header from "../Header";
import OrdersTab from "./OrdersTab";
import SettingsTab from "./SettingsTab";
import type { AdminData } from "./types";

export default function AdminApp() {
  const sb = browserClient();
  const [lang, setLang] = useLang();
  const t = (k: string) => T[lang][k];
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState<"orders" | "settings">("orders");

  // sign-in form
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  const load = useCallback(async () => {
    setLoadErr("");
    await sb.rpc("expire_holds");
    const [fs, ar, pr, di, st, or, ad] = await Promise.all([
      sb.from("farm_settings").select("*").eq("id", 1).single(),
      sb.from("areas").select("*").order("sort").order("name_he"),
      sb.from("products").select("*").order("sort").order("name_he"),
      sb.from("distributions").select("*").order("date", { ascending: false }),
      sb.from("stock").select("*"),
      sb.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(3000),
      sb.from("admins").select("*").order("added_at"),
    ]);
    const firstErr = [fs, ar, pr, di, st, or, ad].find((r) => r.error);
    if (firstErr?.error) { setLoadErr(firstErr.error.message); return; }
    setData({ farm: fs.data, areas: ar.data!, products: pr.data!, dists: di.data!, stock: st.data!, orders: or.data!, admins: ad.data! });
  }, [sb]);

  useEffect(() => {
    if (!session) { setIsAdmin(null); setData(null); return; }
    sb.rpc("is_admin").then(({ data }) => {
      setIsAdmin(Boolean(data));
      if (data) load();
    });
  }, [session, sb, load]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setMsg("");
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/admin`, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setMsg(t("loginErr")); else { setSent(true); setMsg(t("loginSent")); }
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setMsg(t("loginBad"));
  };

  const header = (
    <Header lang={lang} setLang={setLang} name={t("admin")}>
      {session && isAdmin ? (
        <div className="seg" role="group">
          <button aria-pressed={tab === "orders"} onClick={() => setTab("orders")}>{t("tabOrders")}</button>
          <button aria-pressed={tab === "settings"} onClick={() => setTab("settings")}>{t("tabSettings")}</button>
        </div>
      ) : null}
    </Header>
  );

  if (!configured) return <>{header}<main className="doc"><p>{t("notSetup")}</p></main></>;
  if (session === undefined) return <>{header}<main className="login"><p>{t("loading")}</p></main></>;

  if (!session) {
    return (
      <>
        {header}
        <main className="login">
          <h1>{t("loginT")}</h1>
          <p className="hint">{t("loginLead")}</p>
          <form className="f" onSubmit={sent ? verify : sendCode}>
            <label>{t("loginEmail")}<input id="login-email" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sent} /></label>
            {sent ? <label>{t("loginCode")}<input id="login-code" inputMode="numeric" dir="ltr" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label> : null}
            {msg ? <p className={sent && msg === t("loginSent") ? "ok-inline" : "err-inline"}>{msg}</p> : null}
            <button className="primary" type="submit" disabled={busy}>{sent ? t("loginVerify") : t("loginSend")}</button>
            {sent ? <button type="button" className="link" onClick={() => { setSent(false); setCode(""); setMsg(""); }}>{t("loginEmail")} ←</button> : null}
          </form>
        </main>
      </>
    );
  }

  if (isAdmin === false) {
    return (
      <>
        {header}
        <main className="login">
          <p className="statusbox warn">{t("notAdmin")}</p>
          <button className="ghost" onClick={() => sb.auth.signOut()}>{t("signOut")}</button>
        </main>
      </>
    );
  }

  return (
    <>
      {header}
      <main className="wide">
        <div className="row" style={{ justifyContent: "flex-end", gap: 12 }}>
          <Link href="/" target="_blank" className="link">{t("viewSite")}</Link>
          <button className="link" onClick={() => sb.auth.signOut()}>{t("signOut")} ({session.user.email})</button>
        </div>
        {loadErr ? <p className="statusbox warn">{loadErr}</p> : null}
        {!data ? <p>{t("loading")}</p> : tab === "orders"
          ? <OrdersTab data={data} lang={lang} reload={load} />
          : <SettingsTab data={data} lang={lang} reload={load} ownerEmail={session.user.email || ""} />}
      </main>
    </>
  );
}

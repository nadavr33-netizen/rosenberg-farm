"use client";
import { useState } from "react";
import type { Lang } from "@/lib/types";
import { T, pick } from "@/lib/i18n";
import { safeWa } from "@/lib/format";
import { browserClient, imageUrl } from "@/lib/supabase";
import { CatIcon } from "../icons";
import type { AdminData, AreaRow, DistRow, ProductRow } from "./types";

type Row = Record<string, unknown>;
interface Field { key: string; label: string; type?: "text" | "number" | "date" | "tel" | "url" | "email" | "checkbox" | "select" | "areas"; ltr?: boolean; ph?: string; options?: [string, string][] }

/** One editable record with its own Save button. */
function RowEditor({ row, fields, lang, onSave, onDelete, extra, isNew }: {
  row: Row; fields: Field[]; lang: Lang; isNew?: boolean;
  onSave: (r: Row) => Promise<string | null>; onDelete?: () => Promise<string | null>;
  extra?: React.ReactNode;
}) {
  const t = (k: string) => T[lang][k];
  const [v, setV] = useState<Row>(row);
  const [dirty, setDirty] = useState(Boolean(isNew));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [askDel, setAskDel] = useState(false);
  const set = (k: string, val: unknown) => { setV((x) => ({ ...x, [k]: val })); setDirty(true); setMsg(null); };
  const id = (k: string) => `c-${String(row.id ?? "new")}-${k}`;

  const save = async () => {
    setBusy(true);
    const err = await onSave(v);
    setBusy(false);
    if (err) setMsg({ ok: false, text: err }); else { setDirty(false); setMsg({ ok: true, text: t("saved") }); }
  };
  const del = async () => {
    if (!onDelete) return;
    setBusy(true);
    const r = await onDelete();
    setBusy(false); setAskDel(false);
    if (r) setMsg({ ok: r === t("archived"), text: r });
  };

  return (
    <div className="card">
      {extra}
      <div className="grid2">
        {fields.map((f) => {
          if (f.type === "checkbox") return (
            <label key={f.key} className="chk"><input id={id(f.key)} type="checkbox" checked={Boolean(v[f.key])} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}</label>
          );
          if (f.type === "select") return (
            <label key={f.key} className="cf"><span>{f.label}</span>
              <select className="ci" id={id(f.key)} value={String(v[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                {f.options!.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
              </select></label>
          );
          if (f.type === "areas") {
            const cur = (v[f.key] as string[]) || [];
            return (
              <div key={f.key} className="cf" style={{ gridColumn: "1 / -1" }}><span>{f.label}</span>
                <div className="areachk">{f.options!.map(([val, lab]) => (
                  <label key={val}><input type="checkbox" checked={cur.includes(val)} onChange={(e) => set(f.key, e.target.checked ? [...cur, val] : cur.filter((x) => x !== val))} /> {lab}</label>
                ))}</div></div>
            );
          }
          return (
            <label key={f.key} className="cf"><span>{f.label}</span>
              <input className="ci" id={id(f.key)} type={f.type || "text"} dir={f.ltr ? "ltr" : undefined} placeholder={f.ph}
                value={v[f.key] === null || v[f.key] === undefined ? "" : String(v[f.key])}
                onChange={(e) => set(f.key, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} /></label>
          );
        })}
      </div>
      <div className="cardfoot">
        <span className="rowacts">
          <button className="primary" style={{ padding: "8px 16px" }} onClick={save} disabled={!dirty || busy}>{busy ? t("saving") : t("save")}</button>
          {msg ? <span className={msg.ok ? "ok-inline" : "err-inline"}>{msg.text}</span> : null}
        </span>
        {onDelete ? (askDel
          ? <span className="rowacts"><button className="link danger" onClick={del}>{t("confirmDel")}</button><button className="link" onClick={() => setAskDel(false)}>{t("admKeep")}</button></span>
          : <button className="link danger" onClick={() => setAskDel(true)}>{t("delete")}</button>) : null}
      </div>
    </div>
  );
}

async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.85));
  } finally { URL.revokeObjectURL(url); }
}

export default function SettingsTab({ data, lang, reload, ownerEmail }: { data: AdminData; lang: Lang; reload: () => Promise<void>; ownerEmail: string }) {
  const sb = browserClient();
  const t = (k: string) => T[lang][k];
  const [newRows, setNewRows] = useState<{ kind: "pickup" | "delivery" | "area" | "product"; key: number }[]>([]);
  const [photoMsg, setPhotoMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [adm, setAdm] = useState({ name: "", email: "", phone: "" });
  const [admMsg, setAdmMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [admAsk, setAdmAsk] = useState<string | null>(null);
  const areaOpts: [string, string][] = data.areas.filter((a) => a.active).map((a) => [a.id, pick(a, "name", lang)]);
  const catOpts: [string, string][] = (["mango", "avocado", "tomato", "oil"] as const).map((c) => [c, t("catName")[c]]);

  const err = (e: { message: string; code?: string } | null) => (e ? `${t("saveErr")} (${e.message})` : null);
  const nm = (x: unknown) => String(x ?? "").trim();

  /** Delete, or archive when orders still point at the record. */
  const remove = async (table: string, id: string) => {
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error?.code === "23503") {
      const r = await sb.from(table).update({ active: false }).eq("id", id);
      await reload();
      return r.error ? err(r.error) : t("archived");
    }
    await reload();
    return err(error);
  };

  const distFields = (type: "pickup" | "delivery"): Field[] => type === "pickup" ? [
    { key: "name_he", label: t("cfgNameHe") }, { key: "name_en", label: t("cfgNameEn"), ltr: true },
    { key: "place_he", label: t("cfgPlaceHe") }, { key: "place_en", label: t("cfgPlaceEn"), ltr: true },
    { key: "date", label: t("cfgDate"), type: "date", ltr: true }, { key: "time_label", label: t("cfgTime"), ltr: true, ph: "08:00–11:00" },
    { key: "phone", label: t("cfgPhone"), type: "tel", ltr: true, ph: "050-0000000" },
    { key: "whatsapp", label: t("cfgWa"), type: "url", ltr: true, ph: "https://chat.whatsapp.com/…" },
    { key: "active", label: t("active"), type: "checkbox" },
  ] : [
    { key: "date", label: t("cfgDate"), type: "date", ltr: true }, { key: "time_label", label: t("cfgTime"), ltr: true, ph: "10:00–18:00" },
    { key: "area_ids", label: t("cfgAreasFor"), type: "areas", options: areaOpts },
    { key: "active", label: t("active"), type: "checkbox" },
  ];
  const saveDist = async (r: Row, isNew: boolean) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nm(r.date))) return t("cfgErr");
    if (r.type === "pickup" && !nm(r.name_he)) return t("cfgErr");
    if (r.type === "delivery" && !((r.area_ids as string[]) || []).length) return t("cfgErr");
    if (nm(r.whatsapp) && !safeWa(nm(r.whatsapp))) return t("cfgWaErr");
    const body = { type: r.type, date: r.date, time_label: nm(r.time_label), name_he: nm(r.name_he), name_en: nm(r.name_en), place_he: nm(r.place_he), place_en: nm(r.place_en),
      phone: nm(r.phone), whatsapp: nm(r.whatsapp), area_ids: r.area_ids || [], active: r.active !== false };
    const { error } = isNew ? await sb.from("distributions").insert(body) : await sb.from("distributions").update(body).eq("id", r.id);
    if (!error) await reload();
    return err(error);
  };

  const areaFields: Field[] = [
    { key: "name_he", label: t("cfgNameHe") }, { key: "name_en", label: t("cfgNameEn"), ltr: true },
    { key: "fee", label: t("cfgFee"), type: "number", ltr: true }, { key: "active", label: t("active"), type: "checkbox" },
  ];
  const saveArea = async (r: Row, isNew: boolean) => {
    if (!nm(r.name_he) || !(Number(r.fee) >= 0) || r.fee === "") return t("cfgErr");
    const body = { name_he: nm(r.name_he), name_en: nm(r.name_en), fee: Number(r.fee), active: r.active !== false };
    const { error } = isNew ? await sb.from("areas").insert(body) : await sb.from("areas").update(body).eq("id", r.id);
    if (!error) await reload();
    return err(error);
  };

  const prodFields: Field[] = [
    { key: "name_he", label: t("cfgNameHe") }, { key: "name_en", label: t("cfgNameEn"), ltr: true },
    { key: "unit_he", label: t("cfgUnitHe") }, { key: "unit_en", label: t("cfgUnitEn"), ltr: true },
    { key: "note_he", label: t("cfgNoteHe") }, { key: "note_en", label: t("cfgNoteEn"), ltr: true },
    { key: "price", label: t("cfgPrice"), type: "number", ltr: true }, { key: "cat", label: t("cfgCat"), type: "select", options: catOpts },
    { key: "vat", label: t("cfgVat"), type: "checkbox" }, { key: "active", label: t("active"), type: "checkbox" },
  ];
  const saveProduct = async (r: Row, isNew: boolean) => {
    if (!nm(r.name_he) || r.price === "" || !(Number(r.price) >= 0)) return t("cfgErr");
    const body = { cat: r.cat, name_he: nm(r.name_he), name_en: nm(r.name_en), unit_he: nm(r.unit_he), unit_en: nm(r.unit_en), note_he: nm(r.note_he), note_en: nm(r.note_en),
      price: Number(r.price), vat: Boolean(r.vat), active: r.active !== false };
    const { error } = isNew ? await sb.from("products").insert(body) : await sb.from("products").update(body).eq("id", r.id);
    if (!error) await reload();
    return err(error);
  };
  const uploadPhoto = async (p: ProductRow, file?: File) => {
    if (!file) return;
    setPhotoMsg({ id: p.id, ok: true, text: t("phUploading") });
    try {
      let blob: Blob = file, type = file.type || "image/jpeg";
      try { blob = await shrink(file); type = "image/jpeg"; } catch { /* keep the original file */ }
      const path = `${p.id}/${Date.now()}.jpg`;
      const up = await sb.storage.from("product-images").upload(path, blob, { contentType: type, upsert: false });
      if (up.error) throw up.error;
      const { error } = await sb.from("products").update({ image_path: path }).eq("id", p.id);
      if (error) throw error;
      if (p.image_path) await sb.storage.from("product-images").remove([p.image_path]);
      setPhotoMsg({ id: p.id, ok: true, text: t("saved") });
      await reload();
    } catch { setPhotoMsg({ id: p.id, ok: false, text: t("phFail") }); }
  };
  const removePhoto = async (p: ProductRow) => {
    await sb.from("products").update({ image_path: null }).eq("id", p.id);
    if (p.image_path) await sb.storage.from("product-images").remove([p.image_path]);
    await reload();
  };
  const photoBlock = (p: ProductRow) => {
    const img = imageUrl(p.image_path);
    return (
      <div className="photo">
        {img ? <img src={img} alt="" /> : <div className="ph-empty"><CatIcon cat={p.cat} /></div>}
        <div className="photo-act">
          <label className="ghost filebtn">{img ? t("phReplace") : t("phAdd")}
            <input type="file" accept="image/*" hidden onChange={(e) => uploadPhoto(p, e.target.files?.[0])} /></label>
          {img ? <button type="button" className="link danger" onClick={() => removePhoto(p)}>{t("phRemove")}</button> : null}
          {photoMsg && photoMsg.id === p.id ? <span className={photoMsg.ok ? "ok-inline" : "err-inline"}>{photoMsg.text}</span> : null}
        </div>
      </div>
    );
  };

  const farmFields: Field[] = [
    { key: "name_he", label: t("cfgNameHe") }, { key: "name_en", label: t("cfgNameEn"), ltr: true },
    { key: "addr_he", label: t("cfgAddrHe") }, { key: "addr_en", label: t("cfgAddrEn"), ltr: true },
    { key: "dealer_no", label: t("cfgDealer"), ltr: true }, { key: "contact_phone", label: t("contactPhone"), type: "tel", ltr: true },
    { key: "bank_benef_he", label: t("cfgBenefHe") }, { key: "bank_benef_en", label: t("cfgBenefEn"), ltr: true },
    { key: "bank_name_he", label: t("cfgBankHe") }, { key: "bank_name_en", label: t("cfgBankEn"), ltr: true },
    { key: "bank_branch", label: t("cfgBranch"), ltr: true }, { key: "bank_account", label: t("cfgAcct"), ltr: true },
    { key: "transfer_hold_hours", label: t("holdHours"), type: "number", ltr: true },
    { key: "online_payments_enabled", label: t("onlinePay"), type: "checkbox" },
  ];
  const saveFarm = async (r: Row) => {
    const h = Number(r.transfer_hold_hours);
    if (!nm(r.name_he) || !(h >= 1 && h <= 168)) return t("cfgErr");
    const { id: _id, updated_at: _u, ...body } = r as Row & { id: number; updated_at?: string };
    const { error } = await sb.from("farm_settings").update({ ...body, transfer_hold_hours: h, updated_at: new Date().toISOString() }).eq("id", 1);
    if (!error) await reload();
    return err(error);
  };

  const addAdmin = async () => {
    const email = adm.email.trim().toLowerCase();
    if (!adm.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setAdmMsg({ ok: false, text: t("admBadEmail") }); return; }
    const { error } = await sb.from("admins").insert({ email, name: adm.name.trim(), phone: adm.phone.trim() });
    if (error) setAdmMsg({ ok: false, text: err(error)! });
    else { setAdm({ name: "", email: "", phone: "" }); setAdmMsg({ ok: true, text: t("admAdded")(adm.name.trim()) }); await reload(); }
  };
  const removeAdmin = async (email: string) => {
    const { error } = await sb.from("admins").delete().eq("email", email);
    setAdmAsk(null);
    setAdmMsg(error ? { ok: false, text: err(error)! } : { ok: true, text: t("admRemoved")(email) });
    await reload();
  };

  const add = (kind: "pickup" | "delivery" | "area" | "product") => setNewRows((n) => [...n, { kind, key: Date.now() }]);
  const dropNew = (key: number) => setNewRows((n) => n.filter((x) => x.key !== key));
  const addBtn = (kind: "pickup" | "delivery" | "area" | "product", label: string) => <button type="button" className="addbtn" onClick={() => add(kind)}>{label}</button>;
  const blankDist = (type: "pickup" | "delivery"): Row => ({ type, date: "", time_label: type === "delivery" ? "10:00–18:00" : "", name_he: "", name_en: "", place_he: "", place_en: "", phone: "", whatsapp: "", area_ids: [], active: true });

  const byDate = (a: DistRow, b: DistRow) => b.date.localeCompare(a.date);
  const newOf = (kind: string) => newRows.filter((n) => n.kind === kind);

  return (
    <>
      <div className="adm-head"><div className="lead"><h1>{t("cfgTitle")}</h1><p>{t("cfgLead")}</p></div></div>

      <section className="sec"><h2>{t("cfgPickups")}</h2>
        <div className="cards">
          {newOf("pickup").map((n) => <RowEditor key={n.key} isNew row={blankDist("pickup")} fields={distFields("pickup")} lang={lang}
            onSave={async (r) => { const e = await saveDist(r, true); if (!e) dropNew(n.key); return e; }} onDelete={async () => { dropNew(n.key); return null; }} />)}
          {data.dists.filter((d) => d.type === "pickup").sort(byDate).map((d) => <RowEditor key={d.id} row={d as unknown as Row} fields={distFields("pickup")} lang={lang}
            onSave={(r) => saveDist(r, false)} onDelete={() => remove("distributions", d.id)} />)}
          {addBtn("pickup", t("cfgAddPickup"))}
        </div>
        <p className="hint" style={{ marginTop: 8 }}>{t("stockHint")}</p>
      </section>

      <section className="sec"><h2>{t("cfgDeliveries")}</h2>
        <div className="cards">
          {newOf("delivery").map((n) => <RowEditor key={n.key} isNew row={blankDist("delivery")} fields={distFields("delivery")} lang={lang}
            onSave={async (r) => { const e = await saveDist(r, true); if (!e) dropNew(n.key); return e; }} onDelete={async () => { dropNew(n.key); return null; }} />)}
          {data.dists.filter((d) => d.type === "delivery").sort(byDate).map((d) => <RowEditor key={d.id} row={d as unknown as Row} fields={distFields("delivery")} lang={lang}
            onSave={(r) => saveDist(r, false)} onDelete={() => remove("distributions", d.id)} />)}
          {addBtn("delivery", t("cfgAddDelivery"))}
        </div>
      </section>

      <section className="sec"><h2>{t("cfgAreas")}</h2>
        <div className="cards">
          {newOf("area").map((n) => <RowEditor key={n.key} isNew row={{ name_he: "", name_en: "", fee: 0, active: true }} fields={areaFields} lang={lang}
            onSave={async (r) => { const e = await saveArea(r, true); if (!e) dropNew(n.key); return e; }} onDelete={async () => { dropNew(n.key); return null; }} />)}
          {data.areas.map((a: AreaRow) => <RowEditor key={a.id} row={a as unknown as Row} fields={areaFields} lang={lang}
            onSave={(r) => saveArea(r, false)} onDelete={() => remove("areas", a.id)} />)}
          {addBtn("area", t("cfgAddArea"))}
        </div>
      </section>

      <section className="sec"><h2>{t("cfgProducts")}</h2>
        <div className="cards">
          {newOf("product").map((n) => <RowEditor key={n.key} isNew row={{ cat: "mango", name_he: "", name_en: "", unit_he: "", unit_en: "", note_he: "", note_en: "", price: "", vat: false, active: true }} fields={prodFields} lang={lang}
            onSave={async (r) => { const e = await saveProduct(r, true); if (!e) dropNew(n.key); return e; }} onDelete={async () => { dropNew(n.key); return null; }} />)}
          {data.products.map((p) => <RowEditor key={p.id} row={p as unknown as Row} fields={prodFields} lang={lang} extra={photoBlock(p)}
            onSave={(r) => saveProduct(r, false)} onDelete={() => remove("products", p.id)} />)}
          {addBtn("product", t("cfgAddProduct"))}
        </div>
      </section>

      <section className="sec"><h2>{t("cfgFarm")}</h2>
        <RowEditor row={data.farm as unknown as Row} fields={farmFields} lang={lang} onSave={saveFarm} />
      </section>

      <section className="sec"><h2>{t("admT")}</h2>
        <p className="hint" style={{ margin: "0 0 10px" }}>{t("admLead")}</p>
        <div className="card">
          <div>
            {data.admins.map((a) => (
              <div className="adrow" key={a.email}>
                <div className="pmain"><b>{a.name || a.email}</b><div className="pnote" dir="ltr">{[a.email, a.phone].filter(Boolean).join(" · ")}</div></div>
                {a.is_owner ? <span className="tag">{t("admOwnerTag")}</span>
                  : a.email === ownerEmail.toLowerCase() ? null
                  : admAsk === a.email
                    ? <span className="rowacts"><button className="link danger" onClick={() => removeAdmin(a.email)}>{t("admConfirm")}</button><button className="link" onClick={() => setAdmAsk(null)}>{t("admKeep")}</button></span>
                    : <button className="link danger" onClick={() => setAdmAsk(a.email)}>{t("cfgRemove")}</button>}
              </div>
            ))}
          </div>
          <div className="grid3">
            <label className="cf"><span>{t("adm_name")}</span><input className="ci" id="adm-name" value={adm.name} onChange={(e) => setAdm({ ...adm, name: e.target.value })} /></label>
            <label className="cf"><span>{t("adm_email")}</span><input className="ci" id="adm-email" type="email" dir="ltr" value={adm.email} onChange={(e) => setAdm({ ...adm, email: e.target.value })} /></label>
            <label className="cf"><span>{t("adm_phone")}</span><input className="ci" id="adm-phone" type="tel" dir="ltr" value={adm.phone} onChange={(e) => setAdm({ ...adm, phone: e.target.value })} /></label>
          </div>
          <div className="cardfoot"><span>{admMsg ? <span className={admMsg.ok ? "ok-inline" : "err-inline"}>{admMsg.text}</span> : null}</span><button className="primary" onClick={addAdmin}>{t("admAdd")}</button></div>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>{t("admLiveNote")}</p>
      </section>
    </>
  );
}

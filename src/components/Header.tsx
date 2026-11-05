"use client";
import Link from "next/link";
import type { Lang } from "@/lib/types";
import { T } from "@/lib/i18n";

export default function Header({ lang, setLang, name, children }: {
  lang: Lang; setLang: (l: Lang) => void; name: string; children?: React.ReactNode;
}) {
  return (
    <header className="top">
      <div className="top-in">
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="badge"><img src="/logo.webp" alt="" /></span>
          <div><b>{name}</b><small>{T[lang].tag}</small></div>
        </Link>
        {children}
        <button className="ghost" lang={lang === "he" ? "en" : "he"} onClick={() => setLang(lang === "he" ? "en" : "he")}>
          {T[lang].lang}
        </button>
      </div>
    </header>
  );
}

"use client";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/types";

const KEY = "rf-lang";

export function useLang(initial: Lang = "he"): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(initial);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "he" || saved === "en") setLangState(saved);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch {}
  };
  return [lang, setLang];
}

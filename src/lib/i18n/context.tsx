"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { type Lang, LANG_META, LANG_COOKIE, translations } from "./translations";

const LS_KEY = LANG_COOKIE;

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LangCtx = createContext<Ctx>({ lang: "he", setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("he");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY) as Lang | null;
      if (saved && saved in translations) {
        setLangState(saved);
        applyLang(saved);
      }
    } catch {}
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem(LS_KEY, l); } catch {}
    document.cookie = `${LS_KEY}=${l}; path=/; max-age=31536000; SameSite=Lax`;
    applyLang(l);
  }

  useEffect(() => { applyLang(lang); }, [lang]);

  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

function applyLang(l: Lang) {
  const { dir } = LANG_META[l];
  document.documentElement.dir = dir;
  document.documentElement.lang = l;
}

export function useLang() { return useContext(LangCtx); }

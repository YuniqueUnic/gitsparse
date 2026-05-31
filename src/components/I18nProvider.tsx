"use client";

import * as React from "react";
import { createContext, useContext, useState, useEffect } from "react";

// Load namespace translations synchronously for zero-latency initial rendering
import enCommon from "../locales/en/common.json";
import enDialogs from "../locales/en/dialogs.json";
import enMain from "../locales/en/main.json";
import enUsage from "../locales/en/usage.json";

import zhCommon from "../locales/zh/common.json";
import zhDialogs from "../locales/zh/dialogs.json";
import zhMain from "../locales/zh/main.json";
import zhUsage from "../locales/zh/usage.json";

export type Locale = "en" | "zh";

const translations = {
  en: {
    common: enCommon,
    dialogs: enDialogs,
    main: enMain,
    usage: enUsage,
  },
  zh: {
    common: zhCommon,
    dialogs: zhDialogs,
    main: zhMain,
    usage: zhUsage,
  },
} as const;

type Namespace = keyof typeof translations.en;

interface I18nContextProps {
  locale: Locale;
  changeLanguage: (lang: Locale) => void;
  t: (path: string, variables?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("gitsparse_locale");
      if (stored === "en" || stored === "zh") return stored;
    }
    return "en";
  });

  const changeLanguage = (lang: Locale) => {
    setLocale(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("gitsparse_locale", lang);
    }
  };

  const t = (path: string, variables?: Record<string, string | number>): string => {
    let namespace: Namespace = "common";
    let key = path;

    if (path.includes(":")) {
      const parts = path.split(":");
      const ns = parts[0] as Namespace;
      if (translations[locale][ns]) {
        namespace = ns;
        key = parts.slice(1).join(":");
      }
    }

    const dict = translations[locale][namespace] as Record<string, string>;
    let template = dict[key] || translations["en"][namespace][key as keyof typeof translations["en"][typeof namespace]] || key;

    // Replace curly bracket variables like {{count}} or {{matched}}
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        template = template.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(v));
      });
    }

    return template;
  };

  return (
    <I18nContext.Provider value={{ locale, changeLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}

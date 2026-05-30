"use client";

import { useTranslation, Locale } from "./I18nProvider";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const { locale, changeLanguage } = useTranslation();

  const toggleLanguage = () => {
    const nextLang: Locale = locale === "en" ? "zh" : "en";
    changeLanguage(nextLang);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      title={locale === "en" ? "切换至中文" : "Switch to English"}
      className="h-8 gap-1.5 transition-all text-xs border-border bg-transparent text-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/20 select-none"
    >
      <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-[spin_8s_linear_infinite]" />
      <span className="font-semibold tracking-wider">
        {locale === "en" ? "EN" : "中文"}
      </span>
    </Button>
  );
}

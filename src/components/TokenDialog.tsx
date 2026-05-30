"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { useTranslation } from "./I18nProvider";

export interface TokenDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (token: string) => void;
}

export function TokenDialog({ isOpen, onOpenChange, onSave }: TokenDialogProps) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [hasSavedToken, setHasSavedToken] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      const savedToken = typeof window !== "undefined" ? localStorage.getItem("github_pat") || "" : "";
      setToken(savedToken);
      setHasSavedToken(!!savedToken);
    }
  }, [isOpen]);

  const handleSave = () => {
    const trimmedToken = token.trim();
    if (trimmedToken) {
      if (typeof window !== "undefined") {
        localStorage.setItem("github_pat", trimmedToken);
      }
      setHasSavedToken(true);
      toast({
        title: t("dialogs:token_saved_toast_title"),
        description: t("dialogs:token_saved_toast_desc"),
      });
      onSave?.(trimmedToken);
    } else {
      handleClear();
      return;
    }
    onOpenChange(false);
  };

  const handleClear = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("github_pat");
    }
    setToken("");
    setHasSavedToken(false);
    toast({
      title: t("dialogs:token_cleared_toast_title"),
      description: t("dialogs:token_cleared_toast_desc"),
    });
    onSave?.("");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <KeyRound className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold">{t("dialogs:token_title")}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground text-left">
            {t("dialogs:token_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Security Alert Box */}
          <div className="flex gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5 text-emerald-500" />
            <div className="text-sm">
              <h4 className="font-semibold text-emerald-800 dark:text-emerald-300">{t("dialogs:token_secure_title")}</h4>
              <p className="text-xs text-muted-foreground/90 mt-1 leading-relaxed">
                {t("dialogs:token_secure_desc")}
              </p>
            </div>
          </div>

          {/* Input Form */}
          <div className="space-y-2.5">
            <Label htmlFor="token" className="text-sm font-semibold">
              {t("dialogs:token_label")}
            </Label>
            <div className="relative flex items-center">
              <Input
                id="token"
                type={showToken ? "text" : "password"}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="pr-10 font-mono text-sm tracking-wider"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-transparent"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle token visibility</span>
              </Button>
            </div>
            <div className="flex justify-between items-center text-xs">
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity font-medium"
              >
                {t("dialogs:token_generate")}
              </a>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 sm:justify-between border-t pt-4">
          <div className="flex justify-start w-full sm:w-auto">
            {hasSavedToken && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleClear}
                className="w-full sm:w-auto flex items-center gap-1.5 transition-all hover:bg-destructive/95"
              >
                <Trash2 className="h-4 w-4" />
                {t("dialogs:token_btn_clear")}
              </Button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              {t("dialogs:token_btn_cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="w-full sm:w-auto transition-all"
            >
              {t("dialogs:token_btn_save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

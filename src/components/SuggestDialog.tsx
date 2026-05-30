"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckSquare, Zap } from "lucide-react";
import { useTranslation } from "./I18nProvider";

export interface SuggestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchMode: () => void;
}

export function SuggestDialog({ isOpen, onOpenChange, onSwitchMode }: SuggestDialogProps) {
  const { t } = useTranslation();

  const handleSwitch = () => {
    onSwitchMode();
    onOpenChange(false);
  };

  const handleDisableForever = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gitsparse_disable_suggest", "true");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold">{t("dialogs:suggest_title")}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground text-left leading-relaxed">
            {t("dialogs:suggest_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-primary">
            <Zap className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <h4 className="font-semibold text-foreground">{t("dialogs:suggest_rec_title")}</h4>
              <p className="text-muted-foreground mt-1 leading-relaxed">
                {t("dialogs:suggest_rec_desc")}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-between border-t pt-4">
          <div className="flex justify-start w-full sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDisableForever}
              className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {t("dialogs:suggest_btn_disable")}
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              {t("dialogs:suggest_btn_close")}
            </Button>
            <Button
              type="button"
              onClick={handleSwitch}
              className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold hover:bg-primary/95"
            >
              {t("dialogs:suggest_btn_switch")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

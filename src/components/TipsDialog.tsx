"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, Terminal, Cpu, CheckCircle2 } from "lucide-react";
import { useTranslation } from "./I18nProvider";

export interface TipsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TipsDialog({ isOpen, onOpenChange }: TipsDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <HelpCircle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold">{t("dialogs:tips_title")}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground text-left">
            {t("dialogs:tips_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Direct HTTP Mode */}
          <div className="rounded-xl border border-border p-4 bg-card/40 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <Terminal className="h-4 w-4" />
                <span>{t("dialogs:tips_direct_title")}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("dialogs:tips_direct_desc")}
              </p>
              
              <div className="pt-2 space-y-1.5">
                <div className="text-[11px] font-bold text-foreground">{t("dialogs:tips_direct_pros_title")}</div>
                <ul className="text-[11px] text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
                  <li>{t("dialogs:tips_direct_pros_1")}</li>
                  <li>{t("dialogs:tips_direct_pros_2")}</li>
                  <li>{t("dialogs:tips_direct_pros_3")}</li>
                </ul>
              </div>

              <div className="pt-1 space-y-1.5">
                <div className="text-[11px] font-bold text-foreground">{t("dialogs:tips_direct_cons_title")}</div>
                <ul className="text-[11px] text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
                  <li>{t("dialogs:tips_direct_cons_1")}</li>
                  <li>{t("dialogs:tips_direct_cons_2")}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Git Sparse Mode */}
          <div className="rounded-xl border border-border p-4 bg-card/40 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-extrabold">
                <Cpu className="h-4 w-4" />
                <span>{t("dialogs:tips_git_title")}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("dialogs:tips_git_desc")}
              </p>

              <div className="pt-2 space-y-1.5">
                <div className="text-[11px] font-bold text-foreground">{t("dialogs:tips_git_pros_title")}</div>
                <ul className="text-[11px] text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
                  <li>{t("dialogs:tips_git_pros_1")}</li>
                  <li>{t("dialogs:tips_git_pros_2")}</li>
                  <li>{t("dialogs:tips_git_pros_3")}</li>
                </ul>
              </div>

              <div className="pt-1 space-y-1.5">
                <div className="text-[11px] font-bold text-foreground">{t("dialogs:tips_git_cons_title")}</div>
                <ul className="text-[11px] text-muted-foreground space-y-1 pl-4 list-disc leading-relaxed">
                  <li>{t("dialogs:tips_git_cons_1")}</li>
                  <li>{t("dialogs:tips_git_cons_2")}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Advice box */}
        <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-primary mt-2">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-semibold text-emerald-800 dark:text-emerald-300">{t("dialogs:tips_advice_title")}</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {t("dialogs:tips_advice_desc")}
            </p>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto font-semibold"
          >
            {t("dialogs:tips_btn_understand")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

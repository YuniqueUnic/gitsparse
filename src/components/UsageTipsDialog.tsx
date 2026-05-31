"use client";

import { useState } from "react";
import { Check, Copy, Terminal, FolderOpen, ShieldCheck, Play, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/components/I18nProvider";

interface UsageTipsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  downloadMode: "direct" | "sparse";
}

interface CodeSnippetProps {
  code: string;
  className?: string;
}

function CodeSnippet({ code, className }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy");
    }
  };

  return (
    <div className={cn("relative group rounded-lg overflow-hidden border border-slate-700/60 bg-slate-950", className)}>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <pre className="text-[13px] font-mono text-emerald-300 p-3.5 pr-10 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}

interface TimelineStepProps {
  step: number;
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  isLast?: boolean;
  badge?: string;
}

function TimelineStep({
  step,
  icon,
  title,
  description,
  children,
  isLast,
  badge,
}: TimelineStepProps) {
  return (
    <div className="flex gap-4">
      {/* Left: Step indicator + connector line */}
      <div className="flex flex-col items-center shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/15 border-2 border-primary/40 text-primary font-bold text-sm shrink-0 shadow-sm shadow-primary/20">
          {step}
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-gradient-to-b from-primary/30 to-border/20 mt-1.5 mb-0 min-h-[1.5rem]" />
        )}
      </div>

      {/* Right: Content */}
      <div className={cn("flex-1 pb-6 min-w-0", isLast && "pb-2")}>
        <div className="flex items-start gap-2 mb-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-foreground font-semibold text-sm">
            <span className="text-primary shrink-0">{icon}</span>
            {title}
          </div>
          {badge && (
            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mb-2.5 leading-relaxed">{description}</p>
        )}
        {children}
      </div>
    </div>
  );
}

export function UsageTipsDialog({ open, onOpenChange, downloadMode }: UsageTipsDialogProps) {
  const { t } = useTranslation();
  const isSparse = downloadMode === "sparse";
  const scriptName = "gitsparse.sh";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-card/60 sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {t("usage:title", { scriptName })
                  .split(scriptName)
                  .flatMap((part, i, arr) =>
                    i < arr.length - 1
                      ? [part, <code key={i} className="font-mono text-primary text-sm">{scriptName}</code>]
                      : [part]
                  )}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {t("usage:subtitle")}
              </DialogDescription>
            </div>
          </div>
          {/* Mode badge */}
          <div className="flex items-center gap-2 mt-3">
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold",
                isSparse
                  ? "bg-violet-500/15 text-violet-500 border-violet-500/30"
                  : "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
              )}
            >
              {isSparse ? t("usage:mode_sparse") : t("usage:mode_direct")}
            </span>
            <span className="text-xs text-muted-foreground">
              {isSparse ? t("usage:mode_sparse_desc") : t("usage:mode_direct_desc")}
            </span>
          </div>
        </DialogHeader>

        {/* Timeline body */}
        <div className="px-6 py-5">
          {/* Step 1: Locate the file */}
          <TimelineStep
            step={1}
            icon={<FolderOpen className="w-4 h-4" />}
            title={t("usage:step1_title")}
            description={t("usage:step1_desc")}
          >
            <CodeSnippet code={`cd ~/Downloads\n# Or wherever you saved the file:\n# cd /path/to/folder`} />
          </TimelineStep>

          {/* Step 2: chmod */}
          <TimelineStep
            step={2}
            icon={<ShieldCheck className="w-4 h-4" />}
            title={t("usage:step2_title")}
            description={t("usage:step2_desc")}
            badge="chmod +x"
          >
            <CodeSnippet code={`chmod +x ${scriptName}`} />
          </TimelineStep>

          {/* Step 3: Run — default */}
          <TimelineStep
            step={3}
            icon={<Play className="w-4 h-4" />}
            title={t("usage:step3_title")}
            description={t("usage:step3_desc")}
          >
            <CodeSnippet code={`bash ./${scriptName}`} />
            <p className="text-[11px] text-muted-foreground mt-1.5 ml-0.5">
              {t("usage:step3_note")}
            </p>
          </TimelineStep>

          {/* Step 4: Custom output dir */}
          <TimelineStep
            step={4}
            icon={<FolderOpen className="w-4 h-4" />}
            title={t("usage:step4_title")}
            description={t("usage:step4_desc")}
            badge="-o <dir>"
          >
            <CodeSnippet code={`bash ./${scriptName} -o ./my-downloads\n# Or an absolute path:\nbash ./${scriptName} -o /tmp/output`} />
          </TimelineStep>

          {/* Step 5: Skip confirmation */}
          <TimelineStep
            step={5}
            icon={<Play className="w-4 h-4" />}
            title={t("usage:step5_title")}
            description={t("usage:step5_desc")}
            badge="-y / --yes"
          >
            <CodeSnippet code={`bash ./${scriptName} -o ./output -y\n# Long form:\nbash ./${scriptName} -o ./output --yes`} />
          </TimelineStep>

          {/* Step 6 (optional): Private repo with PAT */}
          <TimelineStep
            step={6}
            icon={<ShieldCheck className="w-4 h-4" />}
            title={t("usage:step6_title")}
            description={t("usage:step6_desc")}
            badge="GITHUB_PAT"
            isLast={!isSparse}
          >
            <CodeSnippet
              code={`export GITHUB_PAT="ghp_your_token_here"\nbash ./${scriptName} -o ./output -y`}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 ml-0.5">
              {t("usage:step6_note").split("~/.zshrc").flatMap((part, i, arr) =>
                i < arr.length - 1
                  ? [part, <code key={`zshrc-${i}`} className="font-mono">~/.zshrc</code>]
                  : [part]
              ).flatMap((node, i) =>
                typeof node === "string"
                  ? node.split("~/.bashrc").flatMap((part, j, arr) =>
                      j < arr.length - 1
                        ? [part, <code key={`bashrc-${i}-${j}`} className="font-mono">~/.bashrc</code>]
                        : [part]
                    )
                  : [node]
              )}
            </p>
          </TimelineStep>

          {/* Step 7 (sparse only): git prereqs */}
          {isSparse && (
            <TimelineStep
              step={7}
              icon={<Info className="w-4 h-4" />}
              title={t("usage:step7_title")}
              description={t("usage:step7_desc")}
              isLast
            >
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-start gap-1.5">
                  <span className="text-violet-400 shrink-0">•</span>
                  <span>
                    {t("usage:step7_req1").split("git").flatMap((part, i, arr) =>
                      i < arr.length - 1
                        ? [part, <code key={i} className="font-mono text-foreground">git</code>]
                        : [part]
                    )}
                  </span>
                </p>
                <p className="flex items-start gap-1.5">
                  <span className="text-violet-400 shrink-0">•</span>
                  <span>
                    {t("usage:step7_req2").split("git pull").flatMap((part, i, arr) =>
                      i < arr.length - 1
                        ? [part, <code key={i} className="font-mono text-foreground">git pull</code>]
                        : [part]
                    )}
                  </span>
                </p>
                <p className="flex items-start gap-1.5">
                  <span className="text-violet-400 shrink-0">•</span>
                  <span>{t("usage:step7_req3")}</span>
                </p>
              </div>
              <CodeSnippet code={`# Verify git version\ngit --version\n\n# Expected: git version 2.25 or higher`} className="mt-2" />
            </TimelineStep>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-card/40 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("usage:btn_got_it")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

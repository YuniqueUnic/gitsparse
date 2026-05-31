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
import { cn } from "@/lib/utils";

interface UsageTipsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  downloadMode: "direct" | "sparse";
}

interface CodeSnippetProps {
  code: string;
  language?: string;
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
  badgeVariant?: "default" | "secondary" | "outline";
}

function TimelineStep({
  step,
  icon,
  title,
  description,
  children,
  isLast,
  badge,
  badgeVariant = "secondary",
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
            <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium bg-muted/60 text-muted-foreground border-border">
              {badge}
            </span>
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
                How to Use <code className="font-mono text-primary text-sm">{scriptName}</code>
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Step-by-step guide to run the downloaded shell script
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
              {isSparse ? "Git Sparse Mode" : "Direct HTTP Mode"}
            </span>
            <span className="text-xs text-muted-foreground">
              {isSparse ? "Uses git sparse-checkout" : "Uses curl / wget"}
            </span>
          </div>
        </DialogHeader>

        {/* Timeline body */}
        <div className="px-6 py-5">
          {/* Step 1: Locate the file */}
          <TimelineStep
            step={1}
            icon={<FolderOpen className="w-4 h-4" />}
            title="Locate the downloaded script"
            description="Find gitsparse.sh in your downloads folder (usually ~/Downloads) and cd into that directory."
          >
            <CodeSnippet code={`cd ~/Downloads\n# Or wherever you saved the file:\n# cd /path/to/folder`} />
          </TimelineStep>

          {/* Step 2: chmod */}
          <TimelineStep
            step={2}
            icon={<ShieldCheck className="w-4 h-4" />}
            title="Make the script executable"
            description="Grant execute permission to the script so your shell can run it."
            badge="chmod +x"
          >
            <CodeSnippet code={`chmod +x ${scriptName}`} />
          </TimelineStep>

          {/* Step 3: Run — default */}
          <TimelineStep
            step={3}
            icon={<Play className="w-4 h-4" />}
            title="Run the script"
            description={`Download files into the current directory. You will be prompted to confirm before downloading starts.`}
          >
            <CodeSnippet code={`bash ./${scriptName}`} />
            <p className="text-[11px] text-muted-foreground mt-1.5 ml-0.5">
              The script will print how many files will be downloaded and ask for confirmation.
            </p>
          </TimelineStep>

          {/* Step 4: Custom output dir */}
          <TimelineStep
            step={4}
            icon={<FolderOpen className="w-4 h-4" />}
            title="Specify an output directory"
            description={`Use the -o flag to download into a specific folder. The folder will be created if it doesn't exist.`}
            badge="-o <dir>"
          >
            <CodeSnippet code={`bash ./${scriptName} -o ./my-downloads\n# Or an absolute path:\nbash ./${scriptName} -o /tmp/output`} />
          </TimelineStep>

          {/* Step 5: Skip confirmation */}
          <TimelineStep
            step={5}
            icon={<Play className="w-4 h-4" />}
            title="Skip the confirmation prompt"
            description="Use -y or --yes to bypass the interactive confirmation — useful in CI/CD pipelines or scripts."
            badge="-y / --yes"
          >
            <CodeSnippet code={`bash ./${scriptName} -o ./output -y\n# Long form:\nbash ./${scriptName} -o ./output --yes`} />
          </TimelineStep>

          {/* Step 6 (optional): Private repo with PAT */}
          <TimelineStep
            step={6}
            icon={<ShieldCheck className="w-4 h-4" />}
            title="Access private repos or avoid rate limits"
            description={
              `Set your GitHub Personal Access Token (PAT) as an environment variable. ` +
              `The script reads it automatically — never hardcode tokens in scripts.`
            }
            badge="GITHUB_PAT"
            isLast={!isSparse}
          >
            <CodeSnippet
              code={`export GITHUB_PAT="ghp_your_token_here"\nbash ./${scriptName} -o ./output -y`}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 ml-0.5">
              💡 Tip: Add the export to your <code className="font-mono">~/.zshrc</code> or <code className="font-mono">~/.bashrc</code> to persist it.
            </p>
          </TimelineStep>

          {/* Step 7 (sparse only): git prereqs */}
          {isSparse && (
            <TimelineStep
              step={7}
              icon={<Info className="w-4 h-4" />}
              title="Git Sparse mode prerequisites"
              description="The Git Sparse script requires git ≥ 2.25. It will clone a blobless repo into the output directory and selectively checkout only your files."
              isLast
            >
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-start gap-1.5">
                  <span className="text-violet-400 shrink-0">•</span>
                  <span>Requires <code className="font-mono text-foreground">git</code> installed (version ≥ 2.25).</span>
                </p>
                <p className="flex items-start gap-1.5">
                  <span className="text-violet-400 shrink-0">•</span>
                  <span>The output directory becomes a git repo — you can use <code className="font-mono text-foreground">git pull</code> later to update files.</span>
                </p>
                <p className="flex items-start gap-1.5">
                  <span className="text-violet-400 shrink-0">•</span>
                  <span>If only part of a directory was selected, unselected files inside it are automatically removed after checkout.</span>
                </p>
              </div>
              <CodeSnippet code={`# Verify git version\ngit --version\n\n# Expected: git version 2.25 or higher`} className="mt-2" />
            </TimelineStep>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-card/40 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

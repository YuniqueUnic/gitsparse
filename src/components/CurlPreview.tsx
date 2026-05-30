"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Download, Terminal, AlertCircle, File, Folder } from "lucide-react";
import { TreeNode, RepoInfo } from "@/lib/types";
import { downloadCommand, getAllFiles, generateDownloadScript, generateGitSparseScript } from "@/lib/github";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "./I18nProvider";

interface CurlPreviewProps {
  selectedNode: TreeNode | null;
  repoInfo: RepoInfo | null;
  checkedPaths: Set<string>;
  totalSize: number;
  filesMap: Map<string, number>; // Flattened map to calculate sizes dynamically
  downloadMode: "direct" | "sparse";
  setDownloadMode: (mode: "direct" | "sparse") => void;
}

// Custom simple syntax highlighter for Shell scripts
function HighlightedBash({ code }: { code: string }) {
  const lines = code.split("\n");
  
  return (
    <pre className="text-xs sm:text-sm font-mono text-slate-300 dark:text-slate-300 select-text leading-relaxed whitespace-pre">
      {lines.map((line, idx) => {
        if (line.trim().startsWith("#")) {
          return (
            <span key={idx} className="block text-slate-500 italic">
              {line}
            </span>
          );
        }
        
        // Match shell structure keywords
        const parts = line.split(/(\s+)/);
        const rendered = parts.map((part, pIdx) => {
          if (/^(curl|wget)$/.test(part)) {
            return <span key={pIdx} className="text-emerald-400 font-bold">{part}</span>;
          }
          if (/^(while|do|done|case|esac|in|if|then|fi|elif|else)$/.test(part)) {
            return <span key={pIdx} className="text-pink-400 font-semibold">{part}</span>;
          }
          if (part.startsWith("-") && part.length > 1) {
            return <span key={pIdx} className="text-amber-500">{part}</span>;
          }
          if (part.startsWith("$")) {
            return <span key={pIdx} className="text-sky-400 font-medium">{part}</span>;
          }
          if (part.includes("=")) {
            const eqIdx = part.indexOf("=");
            const key = part.slice(0, eqIdx);
            const val = part.slice(eqIdx + 1);
            return (
              <span key={pIdx}>
                <span className="text-amber-400">{key}</span>
                <span className="text-slate-400">=</span>
                <span className="text-emerald-300">{val}</span>
              </span>
            );
          }
          if (/^(".*"|'.*')$/.test(part)) {
            return <span key={pIdx} className="text-emerald-300">{part}</span>;
          }
          return <span key={pIdx}>{part}</span>;
        });

        return (
          <span key={idx} className="block min-h-[1.2rem]">
            {rendered}
          </span>
        );
      })}
    </pre>
  );
}

export function CurlPreview({
  selectedNode,
  repoInfo,
  checkedPaths,
  totalSize,
  filesMap,
  downloadMode,
  setDownloadMode,
}: CurlPreviewProps) {
  const [downloadTool, setDownloadTool] = useState<"curl" | "wget">("curl");
  const [copiedAll, setCopiedAll] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
      toast({
        title: t("main:toast_copied_title"),
        description: t("main:toast_copied_desc"),
      });
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const downloadScript = (scriptContent: string) => {
    try {
      const filename = downloadMode === "sparse" ? "gitsparse.sh" : "gitdownloader.sh";
      const blob = new Blob([scriptContent], { type: "text/x-sh;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: t("main:toast_sh_downloaded_title"),
        description: t("main:toast_sh_downloaded_desc", { filename }),
      });
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  // Tool switcher tabs element
  const renderToolSwitcher = () => (
    <Tabs
      value={downloadTool}
      onValueChange={(val) => setDownloadTool(val as any)}
      className="h-8 shrink-0"
    >
      <TabsList className="bg-slate-950 dark:bg-slate-900 border border-slate-800 p-0.5 h-8">
        <TabsTrigger value="curl" className="text-[10px] h-7 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
          curl
        </TabsTrigger>
        <TabsTrigger value="wget" className="text-[10px] h-7 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
          wget
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  const renderModeSwitcher = () => (
    <Tabs
      value={downloadMode}
      onValueChange={(val) => setDownloadMode(val as any)}
      className="h-8 shrink-0 animate-in fade-in duration-200"
    >
      <TabsList className="bg-slate-950 dark:bg-slate-900 border border-slate-800 p-0.5 h-8">
        <TabsTrigger value="direct" className="text-[10px] h-7 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
          Direct HTTP
        </TabsTrigger>
        <TabsTrigger value="sparse" className="text-[10px] h-7 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
          Git Sparse
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  const hasSelection = checkedPaths.size > 0;
  const hasClickedNode = selectedNode !== null;

  // Render Guide state if nothing is selected or clicked
  if (!hasSelection && !hasClickedNode) {
    return (
      <div className="h-full w-full flex items-center justify-center border border-dashed rounded-lg bg-card/10 p-6 min-h-[300px]">
        <div className="text-center max-w-sm space-y-4">
          <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <Terminal className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold">{t("main:guide_no_selection_title")}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("main:guide_no_selection_desc")}
          </p>
          <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground/80 bg-muted/50 rounded-md p-2 border">
            <AlertCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{t("main:guide_no_selection_info")}</span>
          </div>
        </div>
      </div>
    );
  }

  // 1. Gather files lists and calculate parameters
  let selectedList: string[] = [];
  let title = "";
  let description = "";
  let currentSize = 0;
  let IconComponent = Terminal;

  if (hasSelection) {
    // Checkbox multi-select mode
    selectedList = Array.from(checkedPaths);
    title = t("main:preview_title_multi");
    description = t("main:preview_desc_multi", { count: selectedList.length });
    currentSize = totalSize;
    IconComponent = Terminal;
  } else if (selectedNode && repoInfo) {
    // Single clicked node mode (file or folder)
    if (selectedNode.type === "blob") {
      selectedList = [selectedNode.path];
      title = t("main:preview_title_single_file");
      description = selectedNode.path;
      currentSize = filesMap.get(selectedNode.path) || selectedNode.size || 0;
      IconComponent = File;
    } else {
      selectedList = getAllFiles(selectedNode);
      title = t("main:preview_title_folder");
      description = t("main:preview_desc_folder", { path: selectedNode.path, count: selectedList.length });
      currentSize = selectedList.reduce((acc, path) => acc + (filesMap.get(path) || 0), 0);
      IconComponent = Folder;
    }
  }

  if (!repoInfo) return null;

  const scriptContent = downloadMode === "sparse"
    ? generateGitSparseScript(repoInfo.owner, repoInfo.repo, repoInfo.branch, selectedList)
    : generateDownloadScript(repoInfo.owner, repoInfo.repo, repoInfo.branch, selectedList, downloadTool);

  const sizeStr =
    currentSize > 1024 * 1024
      ? `${(currentSize / (1024 * 1024)).toFixed(2)} MB`
      : `${(currentSize / 1024).toFixed(1)} KB`;

  return (
    <Card className="h-full flex flex-col border border-border bg-card/65 backdrop-blur-md shadow-lg min-h-0">
      <CardHeader className="border-b pb-4 bg-card/40 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <IconComponent className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">{title}</span>
            </CardTitle>
            <CardDescription className="truncate text-xs text-muted-foreground font-mono">
              {description} ({sizeStr})
            </CardDescription>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {downloadMode === "direct" && renderToolSwitcher()}
            {renderModeSwitcher()}
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(scriptContent)}
              className="h-8 transition-all hover:bg-primary/10 hover:text-primary"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copiedAll ? t("common:btn_copied") : t("common:btn_copy_script")}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => downloadScript(scriptContent)}
              className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all hover:scale-[1.02]"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              {t("common:btn_download_sh")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 bg-black/95 dark:bg-black/90 min-h-0 overflow-auto rounded-b-lg">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono p-3 border-b border-slate-800 shrink-0 flex items-center gap-1.5 bg-slate-950/40">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          {downloadMode === "sparse" ? "gitsparse.sh" : `gitdownloader.sh (${downloadTool})`} PREVIEW
        </div>
        <div className="flex-grow min-h-0 p-4 select-text">
          <HighlightedBash code={scriptContent} />
        </div>
      </CardContent>
    </Card>
  );
}
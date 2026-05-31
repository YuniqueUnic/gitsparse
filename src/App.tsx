import { useState, useEffect, useMemo } from "react";
import { RepoInput } from "@/components/RepoInput";
import { TreeView } from "@/components/TreeView";
import { CurlPreview } from "@/components/CurlPreview";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TokenDialog } from "@/components/TokenDialog";
import { TipsDialog } from "@/components/TipsDialog";
import { SuggestDialog } from "@/components/SuggestDialog";
import { RepoInfo, TreeNode, RateLimit } from "@/lib/types";
import { fetchRepoTree, buildTreeStructure, filterTree, fetchRateLimit, fetchRepoBranches, getStoredToken } from "@/lib/github";
import { KeyRound, AlertCircle, Info, Database, Layers, CheckSquare, Square, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { GithubIcon as GithubBrand } from "@/components/icons";
import { useTranslation } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(new Set());
  
  // Branches & Commit select states
  const [branches, setBranches] = useState<string[]>([]);
  const [currentRef, setCurrentRef] = useState("main");
  const [refType, setRefType] = useState<"branch" | "commit">("branch");
  const [commitSha, setCommitSha] = useState("");
  
  // Glob matching states
  const [globPattern, setGlobPattern] = useState("");
  const [debouncedGlob, setDebouncedGlob] = useState("");
  
  // Token & Rate Limit states
  const [hasToken, setHasToken] = useState(false);
  const [isTokenOpen, setIsTokenOpen] = useState(false);
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);

  // Download Mode & Interactive Suggest Modal states
  const [downloadMode, setDownloadMode] = useState<"direct" | "sparse">("direct");
  const [isTipsOpen, setIsTipsOpen] = useState(false);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);

  const { toast } = useToast();
  const { t } = useTranslation();

  // Mobile view: tab switcher between Tree and Preview panels
  const [mobileTab, setMobileTab] = useState<"tree" | "preview">("tree");

  // Monitor checked files to prompt switching to Git Sparse Mode dynamically
  useEffect(() => {
    if (checkedPaths.size > 10 && downloadMode === "direct") {
      const disabled = typeof window !== "undefined" ? localStorage.getItem("gitsparse_disable_suggest") === "true" : false;
      if (!disabled) {
        setIsSuggestOpen(true);
      }
    }
  }, [checkedPaths.size, downloadMode]);

  // Restore last workspace on load to prevent excessive rate-limiting and redundant fetching
  useEffect(() => {
    const token = getStoredToken();
    setHasToken(!!token);
    updateRateLimit(token || undefined);
    
    // Auto-restore last session
    const lastRepoStr = localStorage.getItem("gitsparse_last_repo");
    if (lastRepoStr) {
      try {
        const lastRepo = JSON.parse(lastRepoStr);
        if (lastRepo && lastRepo.owner && lastRepo.repo) {
          autoReloadLastSession(lastRepo);
        }
      } catch (err) {
        console.warn("Failed to parse last session repo:", err);
      }
    }

    // Periodically update rate limit
    const interval = setInterval(() => {
      updateRateLimit();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const autoReloadLastSession = async (repo: any) => {
    // Step 1: Instantly restore tree from cache to avoid blank screen on refresh
    const cachedTreeStr = localStorage.getItem("gitsparse_last_tree");
    const targetRef = repo.branch || "main";

    if (repo.refType === "commit" && repo.commitSha) {
      setRefType("commit");
      setCommitSha(repo.commitSha);
    } else {
      setRefType("branch");
      setCommitSha("");
    }
    setCurrentRef(targetRef);

    if (cachedTreeStr) {
      try {
        const cachedNodes = JSON.parse(cachedTreeStr);
        if (Array.isArray(cachedNodes) && cachedNodes.length > 0) {
          setRepoInfo({ owner: repo.owner, repo: repo.repo, branch: targetRef });
          setTreeNodes(cachedNodes);
          // Restore glob and checked paths immediately from cache
          const lastGlob = localStorage.getItem("gitsparse_last_glob") || "";
          if (lastGlob) setGlobPattern(lastGlob);
          const lastCheckedStr = localStorage.getItem("gitsparse_last_checked");
          if (lastCheckedStr) {
            try {
              const paths = JSON.parse(lastCheckedStr);
              if (Array.isArray(paths)) setCheckedPaths(new Set(paths));
            } catch {}
          }
        }
      } catch (err) {
        console.warn("Failed to parse cached tree:", err);
      }
    }

    // Step 2: Silently refetch fresh tree in background
    setLoading(true);
    try {
      const branchList = await fetchRepoBranches(repo.owner, repo.repo).catch(() => []);
      setBranches(branchList.map((b: {name: string}) => b.name));

      const treeData = await fetchRepoTree(repo.owner, repo.repo, targetRef);
      const nodes = buildTreeStructure(treeData.tree);
      
      setRepoInfo({ owner: repo.owner, repo: repo.repo, branch: targetRef });
      setTreeNodes(nodes);
      // Update cached tree with fresh data
      localStorage.setItem("gitsparse_last_tree", JSON.stringify(nodes));
      updateRateLimit();

      // Re-apply glob pattern and checked paths after fresh fetch
      const lastGlob = localStorage.getItem("gitsparse_last_glob") || "";
      if (lastGlob) setGlobPattern(lastGlob);
      const lastCheckedStr = localStorage.getItem("gitsparse_last_checked");
      if (lastCheckedStr) {
        try {
          const paths = JSON.parse(lastCheckedStr);
          if (Array.isArray(paths)) setCheckedPaths(new Set(paths));
        } catch {}
      }
    } catch (err) {
      console.warn("Failed to auto-reload last session:", err);
    } finally {
      setLoading(false);
    }
  };

  // Save glob pattern on change
  useEffect(() => {
    if (repoInfo) {
      localStorage.setItem("gitsparse_last_glob", globPattern);
    }
  }, [globPattern, repoInfo]);

  // Save checked paths on change
  useEffect(() => {
    if (repoInfo) {
      localStorage.setItem("gitsparse_last_checked", JSON.stringify(Array.from(checkedPaths)));
    }
  }, [checkedPaths, repoInfo]);

  // Debounce glob filter inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGlob(globPattern);
    }, 300);
    return () => clearTimeout(timer);
  }, [globPattern]);

  const updateRateLimit = async (token?: string) => {
    try {
      const data = await fetchRateLimit(token);
      setRateLimit(data.rate);
    } catch (err) {
      console.warn("Failed to fetch rate limit status:", err);
    }
  };

  const handleRepoSubmit = async (repo: RepoInfo) => {
    setLoading(true);
    setSelectedNode(null);
    setCheckedPaths(new Set());
    setGlobPattern("");
    setDebouncedGlob("");
    
    try {
      // 1. Fetch branches in parallel with tree
      const branchList = await fetchRepoBranches(repo.owner, repo.repo).catch(() => []);
      setBranches(branchList.map(b => b.name));
      
      const targetRef = refType === "commit" && commitSha.trim() ? commitSha.trim() : repo.branch;
      setCurrentRef(targetRef);

      // 2. Fetch tree
      const treeData = await fetchRepoTree(repo.owner, repo.repo, targetRef);
      const nodes = buildTreeStructure(treeData.tree);
      
      setRepoInfo({
        owner: repo.owner,
        repo: repo.repo,
        branch: targetRef
      });
      setTreeNodes(nodes);
      
      // Save last session and tree to localStorage
      localStorage.setItem("gitsparse_last_repo", JSON.stringify({
        owner: repo.owner,
        repo: repo.repo,
        branch: targetRef,
        refType,
        commitSha: refType === "commit" ? commitSha.trim() : ""
      }));
      localStorage.setItem("gitsparse_last_tree", JSON.stringify(nodes));
      
      // Update rate limits on success
      updateRateLimit();
      
      toast({
        title: t("main:toast_loaded_title"),
        description: t("main:toast_loaded_desc", { owner: repo.owner, repo: repo.repo, branch: targetRef }),
      });
    } catch (error) {
      console.error("Error fetching repository:", error);
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      const needsToken = message.includes("403") || message.includes("401") || message.includes("429");
      toast({
        variant: "destructive",
        title: t("main:toast_error_title"),
        description: needsToken
          ? `${message}\n\n→ ${t("main:toast_error_token_hint")}`
          : message,
        duration: needsToken ? 8000 : 5000,
      });
      // Auto-open token dialog on auth errors so users can immediately add their PAT
      if (needsToken) {
        setIsTokenOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Triggered when selecting another branch via Dropdown
  const handleBranchChange = async (newBranch: string) => {
    if (!repoInfo) return;
    setLoading(true);
    setSelectedNode(null);
    setCheckedPaths(new Set());
    
    try {
      setCurrentRef(newBranch);
      const treeData = await fetchRepoTree(repoInfo.owner, repoInfo.repo, newBranch);
      const nodes = buildTreeStructure(treeData.tree);
      
      setRepoInfo({
        ...repoInfo,
        branch: newBranch
      });
      setTreeNodes(nodes);
      
      // Save last session and tree to localStorage
      localStorage.setItem("gitsparse_last_repo", JSON.stringify({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        branch: newBranch,
        refType: "branch",
        commitSha: ""
      }));
      localStorage.setItem("gitsparse_last_tree", JSON.stringify(nodes));
      
      updateRateLimit();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Branch Switch Failed",
        description: error instanceof Error ? error.message : "Failed to load branch tree.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Triggered when switching to Commit SHA manually
  const handleCommitSubmit = async () => {
    if (!repoInfo || !commitSha.trim()) return;
    setLoading(true);
    setSelectedNode(null);
    setCheckedPaths(new Set());
    
    try {
      const sha = commitSha.trim();
      setCurrentRef(sha);
      const treeData = await fetchRepoTree(repoInfo.owner, repoInfo.repo, sha);
      const nodes = buildTreeStructure(treeData.tree);
      
      setRepoInfo({
        ...repoInfo,
        branch: sha
      });
      setTreeNodes(nodes);
      
      // Save last session and tree to localStorage
      localStorage.setItem("gitsparse_last_repo", JSON.stringify({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        branch: sha,
        refType: "commit",
        commitSha: sha
      }));
      localStorage.setItem("gitsparse_last_tree", JSON.stringify(nodes));
      
      updateRateLimit();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Commit SHA Switch Failed",
        description: error instanceof Error ? error.message : "Failed to load tree from Commit SHA.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Flattened map to quickly extract sizes of checked leaf nodes
  const filesMap = useMemo(() => {
    const map = new Map<string, number>();
    const collect = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === "blob") {
          map.set(node.path, node.size || 0);
        } else if (node.children) {
          collect(node.children);
        }
      }
    };
    collect(treeNodes);
    return map;
  }, [treeNodes]);

  // Recursively collect all leaf file paths to support full workspace check
  const allLeafFiles = useMemo(() => {
    const list: string[] = [];
    const collect = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === "blob") {
          list.push(node.path);
        } else if (node.children) {
          collect(node.children);
        }
      }
    };
    collect(treeNodes);
    return list;
  }, [treeNodes]);

  // Calculate matching filtered tree nodes
  const filteredNodes = useMemo(() => {
    if (!debouncedGlob) return treeNodes;
    return filterTree(treeNodes, debouncedGlob);
  }, [treeNodes, debouncedGlob]);

  // Recursively collect leaf files in the filtered tree
  const filteredLeafFiles = useMemo(() => {
    const list: string[] = [];
    const collect = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.type === "blob") {
          list.push(node.path);
        } else if (node.children) {
          collect(node.children);
        }
      }
    };
    collect(filteredNodes);
    return list;
  }, [filteredNodes]);

  const totalSelectedSize = useMemo(() => {
    return Array.from(checkedPaths).reduce((acc, path) => acc + (filesMap.get(path) || 0), 0);
  }, [checkedPaths, filesMap]);

  const handleNodeSelect = (node: TreeNode) => {
    setSelectedNode(node);
  };

  const handleCheckChange = (paths: string[], checked: boolean) => {
    const nextChecked = new Set(checkedPaths);
    for (const path of paths) {
      if (checked) {
        nextChecked.add(path);
      } else {
        nextChecked.delete(path);
      }
    }
    setCheckedPaths(nextChecked);
  };

  const handleSelectAllFiltered = () => {
    const nextChecked = new Set(checkedPaths);
    filteredLeafFiles.forEach(path => nextChecked.add(path));
    setCheckedPaths(nextChecked);
    toast({
      title: t("main:toast_batch_selected_title"),
      description: t("main:toast_batch_selected_desc", { count: filteredLeafFiles.length }),
    });
  };

  const handleClearAll = () => {
    setCheckedPaths(new Set());
    toast({
      title: t("main:toast_clear_title"),
      description: t("main:toast_clear_desc"),
    });
  };

  const handleTokenSave = (token: string) => {
    setHasToken(!!token);
    updateRateLimit(token || undefined);
  };

  // Loading skeleton helper for IDE Tree View
  const renderTreeSkeleton = () => (
    <div className="p-4 space-y-3.5 flex-1 overflow-hidden">
      <Skeleton className="h-4 w-32 bg-emerald-500/10" />
      <div className="space-y-2 mt-3">
        <Skeleton className="h-6 w-full bg-muted/40" />
        <Skeleton className="h-6 w-[90%] ml-4 bg-muted/40" />
        <Skeleton className="h-6 w-[80%] ml-8 bg-muted/40" />
        <Skeleton className="h-6 w-[85%] ml-8 bg-muted/40" />
        <Skeleton className="h-6 w-[92%] ml-4 bg-muted/40" />
        <Skeleton className="h-6 w-[70%] ml-8 bg-muted/40" />
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground flex flex-col font-sans transition-colors selection:bg-primary/20">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/30 sticky top-0 z-40 shrink-0">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 overflow-hidden rounded-xl">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-9 h-9 object-contain block" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75 bg-clip-text text-transparent">
                  {t("common:logo_title")}
                </h1>
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded shrink-0">
                  {t("common:tag_pro")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block leading-none mt-0.5 truncate">
                {t("common:description")}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTokenOpen(true)}
              className={`h-8 gap-1.5 transition-all text-xs border-border ${
                hasToken
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-700 dark:hover:text-emerald-300"
                  : "bg-transparent text-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/20"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">
                {hasToken ? t("common:btn_token_configured") : t("common:btn_configure_token")}
              </span>
              <span className={`h-1.5 w-1.5 rounded-full ${hasToken ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            </Button>
            {/* GitHub Repo Button */}
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1.5 transition-all text-xs border-border bg-transparent text-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/20"
            >
              <a
                href="https://github.com/YuniqueUnic/gitsparse"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5"
              >
                <GithubBrand className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden md:inline">{t("common:btn_github")}</span>
              </a>
            </Button>

            {/* Tips Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTipsOpen(true)}
              className="h-8 gap-1.5 transition-all text-xs border-border bg-transparent text-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/20"
            >
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">{t("common:btn_tips")}</span>
            </Button>

            {/* Language Switcher */}
            <LanguageSwitcher />

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Control / Action Panel */}
      <section className="bg-card/10 border-b border-border/80 py-4 shrink-0">
        <div className="container mx-auto px-4 space-y-3">
          {/* Main Repo URL input */}
          <RepoInput onRepoSubmit={handleRepoSubmit} loading={loading} />

          {repoInfo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Branch / Commit Switcher */}
              <div className="bg-card/45 p-2.5 rounded-lg border border-border space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  {t("main:repo_switcher_title")}
                </Label>
                <Tabs value={refType} onValueChange={(v) => setRefType(v as any)} className="w-full">
                  <TabsList className="grid grid-cols-2 h-7 bg-muted p-0.5 border border-border/60">
                    <TabsTrigger value="branch" className="text-[10px] py-1">{t("main:tab_branch")}</TabsTrigger>
                    <TabsTrigger value="commit" className="text-[10px] py-1">{t("main:tab_commit")}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="branch" className="mt-1.5">
                    {branches.length > 0 ? (
                      <Select value={currentRef} onValueChange={handleBranchChange} disabled={loading}>
                        <SelectTrigger className="h-8 text-xs bg-background border-border text-left">
                          <SelectValue placeholder={t("main:placeholder_branch")} />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {branches.map((b) => (
                            <SelectItem key={b} value={b} className="text-xs">
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder={t("main:placeholder_branch_input")}
                        value={currentRef}
                        onChange={(e) => handleBranchChange(e.target.value)}
                        className="h-8 text-xs bg-background border-border"
                        disabled={loading}
                      />
                    )}
                  </TabsContent>
                  <TabsContent value="commit" className="mt-1.5 flex gap-1.5">
                    <Input
                      placeholder={t("main:placeholder_commit")}
                      value={commitSha}
                      onChange={(e) => setCommitSha(e.target.value)}
                      className="h-8 text-xs bg-background border-border font-mono"
                      disabled={loading}
                    />
                    <Button
                      size="sm"
                      onClick={handleCommitSubmit}
                      disabled={loading || !commitSha.trim()}
                      className="h-8 bg-primary hover:bg-primary/90 text-xs text-primary-foreground font-semibold"
                    >
                      {t("common:btn_apply")}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Glob Pattern Filter */}
              <div className="bg-card/45 p-2.5 rounded-lg border border-border space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {t("main:glob_title")}
                  </span>
                  {debouncedGlob && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                      {t("main:glob_matches_badge", { matched: filteredLeafFiles.length, total: allLeafFiles.length })}
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    placeholder={t("main:glob_placeholder")}
                    value={globPattern}
                    onChange={(e) => setGlobPattern(e.target.value)}
                    className="h-8 text-xs bg-background border-border pl-3 pr-8 transition-all focus:border-primary/50"
                  />
                  {globPattern && (
                    <button
                      onClick={() => setGlobPattern("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/10 p-1.5 rounded">
                  <Info className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{t("main:glob_info")}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main Workspace — responsive: tabs on mobile, side-by-side on md+ */}
      <main className="flex-1 min-h-0 container mx-auto px-4 py-3 flex flex-col min-h-0 box-border overflow-hidden">
        {/* Mobile Tab Switcher — only visible on < md */}
        <div className="flex md:hidden shrink-0 mb-3 gap-1 p-1 rounded-lg bg-muted/60 border border-border/60">
          <button
            onClick={() => setMobileTab("tree")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
              mobileTab === "tree"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("main:tree_title")}
          </button>
          <button
            onClick={() => setMobileTab("preview")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
              mobileTab === "preview"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("main:mobile_preview_tab")}
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 overflow-hidden">
          {/* Left Side: Tree view */}
          <section
            className={`
              bg-card/30 border border-border rounded-lg flex flex-col min-h-0 shrink-0 shadow-inner
              md:w-[35%] lg:w-[30%] md:h-full
              ${mobileTab === "tree" ? "flex flex-1" : "hidden"} md:flex
            `}
          >
          <div className="p-3 border-b border-border/80 bg-card/45 flex items-center justify-between gap-2 shrink-0">
            <div>
              <h2 className="font-bold text-sm text-foreground">{t("main:tree_title")}</h2>
              {repoInfo && (
                <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <span>{t("main:tree_selected_prefix")}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{checkedPaths.size}</span>
                  <span>{t("main:tree_selected_suffix", { total: allLeafFiles.length })}</span>
                </div>
              )}
            </div>
            
            {repoInfo && (
              <div className="flex items-center gap-1.5 shrink-0">
                {filteredLeafFiles.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSelectAllFiltered}
                    title={t("main:tree_tooltip_select")}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </Button>
                )}
                {checkedPaths.size > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClearAll}
                    title={t("main:tree_tooltip_clear")}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Square className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-card/5">
            {loading ? (
              renderTreeSkeleton()
            ) : repoInfo ? (
              <TreeView
                nodes={filteredNodes}
                repoInfo={repoInfo}
                checkedPaths={checkedPaths}
                onCheckChange={handleCheckChange}
                onNodeSelect={(node) => {
                  handleNodeSelect(node);
                  // Auto-switch to preview tab on mobile when a file/folder is clicked
                  setMobileTab("preview");
                }}
                selectedPath={selectedNode?.path}
              />
            ) : (
              <div className="flex-grow flex items-center justify-center text-muted-foreground text-center p-6">
                <div className="space-y-2">
                  <Layers className="w-8 h-8 mx-auto opacity-30 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs leading-relaxed max-w-[200px]">
                    {t("main:tree_awaiting_input")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

          {/* Right Side: Command preview */}
          <section
            className={`
              flex-1 min-h-0 flex flex-col overflow-hidden
              ${mobileTab === "preview" ? "flex flex-1" : "hidden"} md:flex
            `}
          >
            <CurlPreview
              selectedNode={selectedNode}
              repoInfo={repoInfo}
              checkedPaths={checkedPaths}
              totalSize={totalSelectedSize}
              filesMap={filesMap}
              allRepoFiles={allLeafFiles}
              downloadMode={downloadMode}
              setDownloadMode={setDownloadMode}
            />
          </section>
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="border-t border-border bg-card/85 px-4 py-2 text-[11px] text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2 z-10 shrink-0 select-none">
        <div className="flex items-center gap-2">
          {rateLimit ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${rateLimit.remaining > 20 ? "bg-emerald-500" : "bg-amber-500 animate-ping"}`} />
                {t("common:api_limit")}: <strong className="text-foreground">{rateLimit.remaining}</strong>/{rateLimit.limit}
              </span>
              <span className="text-border">|</span>
              <span>
                {t("common:resets_in")}: <strong className="text-foreground">
                  {Math.max(0, Math.ceil((rateLimit.reset * 1000 - Date.now()) / 60000))} {t("common:mins")}
                </strong>
              </span>
            </div>
          ) : (
            <span>{t("main:status_checking_limit")}</span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {debouncedGlob && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-semibold">
              {t("main:matches_badge", { count: filteredLeafFiles.length })}
            </span>
          )}
          <span>{t("main:status_label")} <strong className="text-foreground">{loading ? t("common:status_fetching") : repoInfo ? t("common:status_ready") : t("common:status_awaiting")}</strong></span>
        </div>
      </footer>

      {/* Token configuration dialog */}
      <TokenDialog
        isOpen={isTokenOpen}
        onOpenChange={setIsTokenOpen}
        onSave={handleTokenSave}
      />

      {/* Tips / Engine comparison Dialog */}
      <TipsDialog
        isOpen={isTipsOpen}
        onOpenChange={setIsTipsOpen}
      />

      {/* Dynamic suggest Dialog */}
      <SuggestDialog
        isOpen={isSuggestOpen}
        onOpenChange={setIsSuggestOpen}
        onSwitchMode={() => {
          setDownloadMode("sparse");
          toast({
            title: t("main:toast_mode_switched_title"),
            description: t("main:toast_mode_switched_desc"),
          });
        }}
      />

      <Toaster />
    </div>
  );
}

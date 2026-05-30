"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseGitHubUrl } from "@/lib/github";
import { RepoInfo } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { GithubIcon as Github } from "@/components/icons";
import { useTranslation } from "./I18nProvider";

interface RepoInputProps {
  onRepoSubmit: (repoInfo: RepoInfo) => Promise<void>;
  loading: boolean;
}

export function RepoInput({ onRepoSubmit, loading }: RepoInputProps) {
  const [url, setUrl] = useState(() => {
    if (typeof window !== "undefined") {
      const lastRepoStr = localStorage.getItem("gitsparse_last_repo");
      if (lastRepoStr) {
        try {
          const lastRepo = JSON.parse(lastRepoStr);
          if (lastRepo && lastRepo.owner && lastRepo.repo) {
            return `${lastRepo.owner}/${lastRepo.repo}`;
          }
        } catch {}
      }
    }
    return "";
  });

  const [branch, setBranch] = useState(() => {
    if (typeof window !== "undefined") {
      const lastRepoStr = localStorage.getItem("gitsparse_last_repo");
      if (lastRepoStr) {
        try {
          const lastRepo = JSON.parse(lastRepoStr);
          if (lastRepo && lastRepo.branch) {
            return lastRepo.branch;
          }
        } catch {}
      }
    }
    return "main";
  });

  const [error, setError] = useState("");
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!url.trim()) {
      setError(t("main:err_empty_url"));
      return;
    }
    
    const repoInfo = parseGitHubUrl(url.trim(), branch.trim());
    if (!repoInfo) {
      setError(t("main:err_invalid_url"));
      return;
    }
    
    try {
      await onRepoSubmit(repoInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("main:err_failed_fetch"));
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 mb-2 items-center">
        <div className="relative flex-grow w-full flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Github className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={t("common:placeholder_repo_url")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="pl-10 h-10 transition-all text-sm"
              disabled={loading}
            />
          </div>
          <Input
            type="text"
            placeholder={t("main:placeholder_branch_label")}
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full sm:w-28 h-10 transition-all text-sm font-mono"
            disabled={loading}
          />
        </div>
        <div className="relative shrink-0 w-full sm:w-auto">
          <Button 
            type="submit" 
            disabled={loading}
            className="rounded-2xl border-b-4 border-emerald-700 dark:border-emerald-900 active:border-b-0 active:translate-y-[4px] bg-primary text-primary-foreground font-bold hover:bg-primary/95 transition-all hover:scale-[1.03] w-full sm:w-auto h-10 px-6 shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span>{t("common:status_fetching")}</span>
              </>
            ) : (
              <span className="tracking-wide">{t("common:btn_load_repo")}</span>
            )}
          </Button>
          {/* Right-top cute logo badge */}
          <div className="absolute -top-3.5 -right-2 z-[100] animate-bounce pointer-events-none select-none">
            <img src="/logo.png" alt="logo" className="w-10 h-10 object-contain" />
          </div>
        </div>
      </form>
      
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 mt-2">
          {error}
        </div>
      )}
    </div>
  );
}
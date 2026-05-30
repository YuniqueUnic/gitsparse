"use client";

import { useState, useEffect } from "react";
import { TreeNode, RepoInfo } from "@/lib/types";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getAllFiles } from "@/lib/github";

interface TreeViewProps {
  nodes: TreeNode[];
  repoInfo: RepoInfo;
  checkedPaths: Set<string>;
  onCheckChange: (paths: string[], checked: boolean) => void;
  onNodeSelect: (node: TreeNode, repoInfo: RepoInfo) => void;
  selectedPath?: string;
}

interface TreeNodeProps {
  node: TreeNode;
  depth: number;
  repoInfo: RepoInfo;
  checkedPaths: Set<string>;
  onCheckChange: (paths: string[], checked: boolean) => void;
  onNodeSelect: (node: TreeNode, repoInfo: RepoInfo) => void;
  selectedPath?: string;
}

function TreeNodeComponent({
  node,
  depth,
  repoInfo,
  checkedPaths,
  onCheckChange,
  onNodeSelect,
  selectedPath,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(node.isExpanded || false);
  const isSelected = selectedPath === node.path;
  const hasChildren = node.children && node.children.length > 0;

  // React to node.isExpanded changes (e.g. from Glob filtering auto-expansion)
  useEffect(() => {
    if (node.isExpanded !== undefined) {
      setIsExpanded(node.isExpanded);
    }
  }, [node.isExpanded]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === "tree" && hasChildren) {
      setIsExpanded(!isExpanded);
    }
    onNodeSelect(node, repoInfo);
  };

  const getIcon = () => {
    if (node.type === "tree") {
      if (hasChildren && isExpanded) {
        return <FolderOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      }
      return <Folder className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    }
    return <File className="w-4 h-4 text-muted-foreground shrink-0" />;
  };

  const getChevron = () => {
    if (node.type === "tree" && hasChildren) {
      return (
        <button
          onClick={handleToggle}
          className="p-0.5 hover:bg-accent rounded-sm transition-colors shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      );
    }
    return <div className="w-4.5" />;
  };

  // Helper to determine check status of folder
  const leafFiles = getAllFiles(node);
  const checkedLeafCount = leafFiles.filter(f => checkedPaths.has(f)).length;
  
  const isChecked = leafFiles.length > 0 && checkedLeafCount === leafFiles.length;
  const isIndeterminate = checkedLeafCount > 0 && checkedLeafCount < leafFiles.length;

  const handleCheckboxChange = (checked: boolean) => {
    onCheckChange(leafFiles, checked);
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-1.5 h-8 px-2 py-1 transition-all rounded-sm hover:bg-accent/40 group relative cursor-pointer",
          isSelected && "bg-accent text-accent-foreground font-medium"
        )}
        onClick={handleToggle}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {getChevron()}
          <div
            className="p-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isIndeterminate ? "indeterminate" : isChecked}
              onCheckedChange={(checked) => handleCheckboxChange(!!checked)}
              className="h-4 w-4 rounded-sm border-muted-foreground/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
          {getIcon()}
          <span
            className={cn(
              "truncate text-sm transition-colors",
              node.isMatched && "text-foreground font-semibold underline underline-offset-2 decoration-primary decoration-2",
              !node.isMatched && node.type === "blob" && "text-muted-foreground/80"
            )}
          >
            {node.name}
          </span>
          {node.size !== undefined && node.type === "blob" && (
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2">
              ({(node.size / 1024).toFixed(1)} KB)
            </span>
          )}
        </div>
      </div>

      {node.type === "tree" && hasChildren && isExpanded && (
        <div className="relative before:absolute before:left-[17px] before:top-0 before:bottom-2 before:w-[1px] before:bg-border/60 ml-2">
          {node.children!.map((child, index) => (
            <TreeNodeComponent
              key={`${child.path}-${index}`}
              node={child}
              depth={depth + 1}
              repoInfo={repoInfo}
              checkedPaths={checkedPaths}
              onCheckChange={onCheckChange}
              onNodeSelect={onNodeSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView({
  nodes,
  repoInfo,
  checkedPaths,
  onCheckChange,
  onNodeSelect,
  selectedPath,
}: TreeViewProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
        <div className="text-center">
          <Folder className="w-10 h-10 mx-auto mb-3 opacity-30 animate-pulse text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm">No files found in this repository.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto pr-1">
      <div className="p-2 space-y-0.5">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
          Workspace: {repoInfo.owner}/{repoInfo.repo}
        </div>
        {nodes.map((node, index) => (
          <TreeNodeComponent
            key={`${node.path}-${index}`}
            node={node}
            depth={0}
            repoInfo={repoInfo}
            checkedPaths={checkedPaths}
            onCheckChange={onCheckChange}
            onNodeSelect={onNodeSelect}
            selectedPath={selectedPath}
          />
        ))}
      </div>
    </div>
  );
}
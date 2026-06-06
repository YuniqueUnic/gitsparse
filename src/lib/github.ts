import pm from 'picomatch';
import { GitTreeResponse, TreeNode, RepoInfo, RateLimitResponse, RateLimit, ApiResponse } from './types';

// In-flight request cache for deduplication
const inflightRequests = new Map<string, Promise<any>>();

export function dedupedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key)!;
  }
  const promise = fetcher().finally(() => inflightRequests.delete(key));
  inflightRequests.set(key, promise);
  return promise;
}

export function parseGitHubUrl(url: string, branch: string): RepoInfo | null {
  try {
    // Handle shorthand format: owner/repo
    if (!url.includes('://') && url.includes('/')) {
      const parts = url.trim().split('/').filter(Boolean);
      if (parts.length >= 2) {
        return {
          owner: parts[0],
          repo: parts[1],
          branch: branch
        };
      }
      return null;
    }
    
    // Handle full URL format
    const urlObj = new URL(url);
    if (urlObj.hostname !== 'github.com') return null;
    
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) return null;
    
    return {
      owner: pathParts[0],
      repo: pathParts[1],
      branch: branch
    };
  } catch {
    // If URL parsing fails, try shorthand format as fallback
    const trimmed = url.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return {
          owner: parts[0],
          repo: parts[1],
          branch: branch
        };
      }
    }
    return null;
  }
}

export function getStoredToken(): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('github_pat');
  }
  return null;
}

/** Extract rate limit information from GitHub API response headers.
 *  Returns null when X-RateLimit headers are absent (e.g. proxied/cached
 *  responses or test environments where route.fulfill doesn't forward headers). */
function extractRateLimit(res: Response): RateLimit | null {
  const remaining = res.headers.get('X-RateLimit-Remaining');
  if (remaining === null) return null;
  return {
    limit: Number(res.headers.get('X-RateLimit-Limit')) || 60,
    remaining: Number(remaining),
    reset: Number(res.headers.get('X-RateLimit-Reset')) || 0,
  };
}

/** Translates GitHub API HTTP errors into actionable user-facing messages */
function githubApiError(status: number, context: string): Error {
  switch (status) {
    case 401:
      return new Error(`[401 Unauthorized] ${context} — your token is invalid or expired. Please update your GitHub Personal Access Token in the token settings.`);
    case 403:
      return new Error(`[403 Forbidden] ${context} — you have either hit the GitHub API rate limit or this repository requires a Personal Access Token. Add a GitHub PAT via the 🔑 token button to continue.`);
    case 404:
      return new Error(`[404 Not Found] ${context} — the repository or branch does not exist, or it is private. Check the URL, or add a GitHub PAT to access private repositories.`);
    case 429:
      return new Error(`[429 Too Many Requests] ${context} — GitHub API rate limit reached. Add a GitHub PAT (🔑) to get 5000 requests/hour instead of 60.`);
    default:
      if (status >= 500) {
        return new Error(`[${status} Server Error] ${context} — GitHub API is temporarily unavailable. Please try again in a few seconds.`);
      }
      return new Error(`[${status}] ${context} — unexpected error from GitHub API.`);
  }
}

export async function fetchRepoTree(owner: string, repo: string, branch = "main", token?: string, etag?: string): Promise<ApiResponse<GitTreeResponse | null>> {
  const actualToken = token || getStoredToken();
  const headers: Record<string, string> = {};
  if (actualToken) {
    headers['Authorization'] = `token ${actualToken}`;
  }
  if (etag) {
    headers['If-None-Match'] = etag;
  }
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
    headers
  });
  if (res.status === 304) {
    return {
      data: null,
      rateLimit: extractRateLimit(res) ?? undefined,
      etag,
    };
  }
  if (!res.ok) {
    throw githubApiError(res.status, `Fetching tree for ${owner}/${repo}@${branch}`);
  }
  const data = await res.json();
  const newEtag = res.headers.get('ETag') || undefined;
  return {
    data,
    rateLimit: extractRateLimit(res) ?? undefined,
    etag: newEtag,
  };
}

export async function fetchRateLimit(token?: string): Promise<RateLimitResponse> {
  const actualToken = token || getStoredToken();
  const headers: Record<string, string> = {};
  if (actualToken) {
    headers['Authorization'] = `token ${actualToken}`;
  }
  const res = await fetch('https://api.github.com/rate_limit', { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch rate limit: ${res.statusText}`);
  }
  return res.json();
}

export function buildTreeStructure(entries: any[]): TreeNode[] {
  const root: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();
  
  // Sort entries to ensure directories come before their contents
  const sortedEntries = entries.sort((a, b) => {
    const aDepth = a.path.split('/').length;
    const bDepth = b.path.split('/').length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.path.localeCompare(b.path);
  });
  
  for (const entry of sortedEntries) {
    const parts = entry.path.split('/');
    const name = parts[parts.length - 1];
    
    const node: TreeNode = {
      name,
      path: entry.path,
      type: entry.type,
      children: entry.type === 'tree' ? [] : undefined,
      isExpanded: false,
      size: entry.size
    };
    
    nodeMap.set(entry.path, node);
    
    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = nodeMap.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(node);
      }
    }
  }
  
  return root;
}

export function rawFileUrl(owner: string, repo: string, branch: string, path: string): string {
  const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/refs/heads/${encodeURIComponent(branch)}/${encodedPath}`;
}

export function downloadCommand(owner: string, repo: string, branch: string, path: string, tool: 'curl' | 'wget' = 'curl'): string {
  const url = rawFileUrl(owner, repo, branch, path);
  if (tool === 'wget') {
    if (path.includes('/')) {
      const dir = path.substring(0, path.lastIndexOf('/'));
      return `mkdir -p "${dir}" && wget -O "${path}" "${url}"`;
    }
    return `wget -O "${path}" "${url}"`;
  }
  return `curl -L "${url}" --create-dirs -o "${path}"`;
}

export function getAllFiles(node: TreeNode): string[] {
  const files: string[] = [];
  
  if (node.type === 'blob') {
    files.push(node.path);
  } else if (node.children) {
    for (const child of node.children) {
      files.push(...getAllFiles(child));
    }
  }
  
  return files;
}

export function generateFolderDownloadCommands(owner: string, repo: string, branch: string, folderNode: TreeNode, tool: 'curl' | 'wget' = 'curl'): string[] {
  const files = getAllFiles(folderNode);
  return files.map(filePath => downloadCommand(owner, repo, branch, filePath, tool));
}

export function filterTree(nodes: TreeNode[], pattern: string): TreeNode[] {
  if (!pattern.trim()) return nodes;

  // Support comma-separated multi-patterns: "*.json, *.md" -> ["*.json", "*.md"]
  const patterns = pattern.split(',').map(p => p.trim()).filter(Boolean);
  if (patterns.length === 0) return nodes;

  // Build matchers for each individual pattern
  const matchers = patterns.map(p => pm(p, { dot: true }));
  const isMatch = (path: string) => matchers.some(m => m(path));

  const recurse = (treeNodes: TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = [];
    for (const node of treeNodes) {
      if (node.type === 'blob') {
        if (isMatch(node.path)) {
          result.push({
            ...node,
            isMatched: true
          });
        }
      } else {
        const filteredChildren = recurse(node.children || []);
        if (filteredChildren.length > 0) {
          result.push({
            ...node,
            children: filteredChildren,
            isExpanded: true
          });
        }
      }
    }
    return result;
  };

  return recurse(nodes);
}

export function generateDownloadScript(
  owner: string,
  repo: string,
  branch: string,
  selectedPaths: string[],
  tool: 'curl' | 'wget' = 'curl'
): string {
  let script = `#!/bin/bash
# ==============================================================================
# GitSparse - Download Automation Script
# ==============================================================================
# [Security Note]
# To download from private repositories or bypass GitHub API rate limits,
# set the GITHUB_PAT environment variable in your terminal before running:
#   export GITHUB_PAT="your_github_personal_access_token"
# ==============================================================================

OUTPUT_DIR="."
`;

  if (tool === 'wget') {
    script += `
# Setup Authorization Header safely using Bash arrays to prevent word splitting
AUTH_HEADERS=()
if [ -n "$GITHUB_PAT" ]; then
  AUTH_HEADERS+=(--header="Authorization: token $GITHUB_PAT")
elif [ -n "$GITHUB_TOKEN" ]; then
  AUTH_HEADERS+=(--header="Authorization: token $GITHUB_TOKEN")
fi
`;
  } else {
    script += `
# Setup Authorization Header safely using Bash arrays to prevent word splitting
AUTH_HEADERS=()
if [ -n "$GITHUB_PAT" ]; then
  AUTH_HEADERS+=(-H "Authorization: token $GITHUB_PAT")
elif [ -n "$GITHUB_TOKEN" ]; then
  AUTH_HEADERS+=(-H "Authorization: token $GITHUB_TOKEN")
fi
`;
  }

  script += `
BYPASS_CONFIRM=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -y|--yes)
      BYPASS_CONFIRM=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

if [ "$BYPASS_CONFIRM" != "true" ]; then
  read -p "${selectedPaths.length} files will be download into '$OUTPUT_DIR'? [y/N], default N? " confirm
  if [[ ! "$confirm" =~ ^[yY]$ ]]; then
    echo "Download cancelled."
    exit 0
  fi
fi

echo "Downloading files to $OUTPUT_DIR..."
`;

  for (const path of selectedPaths) {
    const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const url = `https://raw.githubusercontent.com/\${owner}/\${repo}/refs/heads/\${branch}/\${path}`
      .replace('\${owner}', encodeURIComponent(owner))
      .replace('\${repo}', encodeURIComponent(repo))
      .replace('\${branch}', encodeURIComponent(branch))
      .replace('\${path}', encodedPath);
    
    if (tool === 'wget') {
      script += `mkdir -p "$OUTPUT_DIR/$(dirname "${path}")" && wget -O "$OUTPUT_DIR/${path}" "\${AUTH_HEADERS[@]}" "${url}"\n`;
    } else {
      script += `curl -L "\${AUTH_HEADERS[@]}" --create-dirs -o "$OUTPUT_DIR/${path}" "${url}"\n`;
    }
  }

  return script;
}

/**
 * Compute optimal sparse-checkout paths from a selected file list and the full repository file list.
 * Strategy:
 *   - For each directory that appears in selectedPaths:
 *     - If ALL files in that dir (from allRepoFiles) are selected → include the whole dir path
 *     - If ONLY SOME files are selected → include the dir path AND record excluded files for post-checkout rm
 *   - Root-level files (no parent dir) are included directly
 *
 * This collapses potentially thousands of file args into a small set of directory args,
 * avoiding shell ARG_MAX limits and making the script human-readable.
 */
export function computeSparsePathsAndCleanup(
  selectedPaths: string[],
  allRepoFiles: string[]
): { sparsePaths: string[]; filesToRemove: string[] } {
  if (selectedPaths.length === 0) return { sparsePaths: [], filesToRemove: [] };

  const selectedSet = new Set(selectedPaths);
  // Group all repo files by their parent directory
  const dirToAllFiles = new Map<string, string[]>();
  for (const f of allRepoFiles) {
    const slashIdx = f.lastIndexOf('/');
    const dir = slashIdx === -1 ? '' : f.slice(0, slashIdx);
    if (!dirToAllFiles.has(dir)) dirToAllFiles.set(dir, []);
    dirToAllFiles.get(dir)!.push(f);
  }

  // Group selected files by their parent directory
  const selectedByDir = new Map<string, string[]>();
  for (const f of selectedPaths) {
    const slashIdx = f.lastIndexOf('/');
    const dir = slashIdx === -1 ? '' : f.slice(0, slashIdx);
    if (!selectedByDir.has(dir)) selectedByDir.set(dir, []);
    selectedByDir.get(dir)!.push(f);
  }

  const sparsePaths: string[] = [];
  const filesToRemove: string[] = [];
  const coveredDirs = new Set<string>();

  for (const [dir, selected] of selectedByDir.entries()) {
    const allInDir = dirToAllFiles.get(dir) || [];
    const allSelected = allInDir.length > 0 && allInDir.every(f => selectedSet.has(f));

    // Use top-level dir segment (e.g. "src" instead of "src/components/Button")
    // to avoid deep path proliferation — git sparse-checkout covers the whole subtree
    const topDir = dir === '' ? '' : dir.split('/')[0];

    if (allSelected) {
      // Full directory — just add the directory (no cleanup needed)
      const pathToAdd = dir === '' ? null : dir;
      if (pathToAdd && !coveredDirs.has(topDir)) {
        sparsePaths.push(dir);
        coveredDirs.add(dir);
      } else if (dir === '') {
        // Root files: add them individually
        for (const f of selected) sparsePaths.push(f);
      }
    } else {
      // Partial directory — checkout the parent dir, then rm unselected files
      if (dir === '') {
        // Root level: just add selected files directly (no dir to rm from)
        for (const f of selected) sparsePaths.push(f);
      } else {
        if (!coveredDirs.has(dir)) {
          sparsePaths.push(dir);
          coveredDirs.add(dir);
        }
        // Files in this dir NOT selected must be removed after checkout
        for (const f of allInDir) {
          if (!selectedSet.has(f)) filesToRemove.push(f);
        }
      }
    }
  }

  return { sparsePaths: [...new Set(sparsePaths)], filesToRemove: [...new Set(filesToRemove)] };
}

export function generateGitSparseScript(
  owner: string,
  repo: string,
  branch: string,
  selectedPaths: string[],
  allRepoFiles: string[] = []
): string {
  const { sparsePaths, filesToRemove } = computeSparsePathsAndCleanup(selectedPaths, allRepoFiles);

  // Fallback: if aggregation produced nothing useful, fall back to raw file list
  const sparseArgs = sparsePaths.length > 0 ? sparsePaths : selectedPaths;

  const removeBlock = filesToRemove.length > 0
    ? `
# Remove files not in your selection (directory was partially checked out)
echo "Cleaning up unselected files..."
${filesToRemove.map(f => `[ -f "${f}" ] && rm "${f}"`).join('\n')}
# Remove any empty dirs left behind
find . -type d -empty -not -name '.git' -not -path './.git/*' -delete 2>/dev/null || true`
    : '';

  return `#!/bin/bash
# ==============================================================================
# GitSparse - High-Performance Sparse Checkout Script
# ==============================================================================
# [Security Note]
# To download from private repositories or bypass GitHub API rate limits,
# set the GITHUB_PAT environment variable in your terminal before running:
#   export GITHUB_PAT="your_github_personal_access_token"
# ==============================================================================
# Sparse paths : ${sparseArgs.length} (covering ${selectedPaths.length} files)
# Files to rm  : ${filesToRemove.length} (partial directory cleanup)
# ==============================================================================

OUTPUT_DIR="."
BYPASS_CONFIRM=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -y|--yes)
      BYPASS_CONFIRM=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

if [ "$BYPASS_CONFIRM" != "true" ]; then
  read -p "${selectedPaths.length} files will be sparse-downloaded into '$OUTPUT_DIR'? [y/N], default N? " confirm
  if [[ ! "$confirm" =~ ^[yY]$ ]]; then
    echo "Download cancelled."
    exit 0
  fi
fi

echo "Initializing sparse-checkout in '$OUTPUT_DIR'..."
mkdir -p "$OUTPUT_DIR"
cd "$OUTPUT_DIR"

# Setup remote URL dynamically with token if provided via GITHUB_PAT or GITHUB_TOKEN
REMOTE_URL="https://github.com/${owner}/${repo}.git"
if [ -n "$GITHUB_PAT" ]; then
  REMOTE_URL="https://oauth2:\\$GITHUB_PAT@github.com/${owner}/${repo}.git"
elif [ -n "$GITHUB_TOKEN" ]; then
  REMOTE_URL="https://oauth2:\\$GITHUB_TOKEN@github.com/${owner}/${repo}.git"
fi

if [ ! -d ".git" ]; then
  git init
  git remote add origin "$REMOTE_URL"
else
  git remote set-url origin "$REMOTE_URL"
fi

git config core.sparseCheckout true
git sparse-checkout init --no-cone

# Set paths to sparse-checkout (directories preferred over individual files)
git sparse-checkout set --no-cone ${sparseArgs.map(p => `"${p}"`).join(' ')}

echo "Fetching branch '${branch}' using blobless filter..."
git fetch --depth 1 --filter=blob:none origin "${branch}"
git checkout "${branch}"
${removeBlock}
echo "Sparse download completed successfully!"
`;
}


export async function fetchRepoBranches(owner: string, repo: string, token?: string): Promise<ApiResponse<{ name: string }[]>> {
  const actualToken = token || getStoredToken();
  const headers: Record<string, string> = {};
  if (actualToken) {
    headers['Authorization'] = `token ${actualToken}`;
  }
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, { headers });
  if (!res.ok) {
    throw githubApiError(res.status, `Fetching branches for ${owner}/${repo}`);
  }
  const data = await res.json();
  return {
    data,
    rateLimit: extractRateLimit(res) ?? undefined,
  };
}
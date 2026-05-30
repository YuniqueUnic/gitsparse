import pm from 'picomatch';
import { GitTreeResponse, TreeNode, RepoInfo, RateLimitResponse } from './types';

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

export async function fetchRepoTree(owner: string, repo: string, branch = "main", token?: string): Promise<GitTreeResponse> {
  const actualToken = token || getStoredToken();
  const headers: Record<string, string> = {};
  if (actualToken) {
    headers['Authorization'] = `token ${actualToken}`;
  }
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
    headers
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Repository not found. Please check the URL and make sure the repository is public or your token is valid.");
    }
    throw new Error(`Failed to fetch repository tree: ${res.statusText}`);
  }
  return res.json();
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
  if (!pattern) return nodes;
  const isMatch = pm(pattern, { dot: true });

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

export function generateGitSparseScript(
  owner: string,
  repo: string,
  branch: string,
  selectedPaths: string[]
): string {
  let script = `#!/bin/bash
# ==============================================================================
# GitSparse - High-Performance Sparse Checkout Script
# ==============================================================================
# [Security Note]
# To download from private repositories or bypass GitHub API rate limits,
# set the GITHUB_PAT environment variable in your terminal before running:
#   export GITHUB_PAT="your_github_personal_access_token"
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
git sparse-checkout init --cone

# Set files to sparse-checkout
git sparse-checkout set ${selectedPaths.map(p => `"${p}"`).join(" ")}

echo "Fetching branch '${branch}' using blobless filter..."
git fetch --depth 1 --filter=blob:none origin "${branch}"
git checkout "${branch}"

echo "Sparse download completed successfully!"
`;

  return script;
}


export async function fetchRepoBranches(owner: string, repo: string, token?: string): Promise<{ name: string }[]> {
  const actualToken = token || getStoredToken();
  const headers: Record<string, string> = {};
  if (actualToken) {
    headers['Authorization'] = `token ${actualToken}`;
  }
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch branches: ${res.statusText}`);
  }
  return res.json();
}
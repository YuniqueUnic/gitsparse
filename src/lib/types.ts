export interface GitTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitTreeResponse {
  sha: string;
  url: string;
  tree: GitTreeEntry[];
  truncated: boolean;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  children?: TreeNode[];
  isExpanded?: boolean;
  isMatched?: boolean;
  size?: number;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
}

export interface RateLimit {
  limit: number;
  remaining: number;
  reset: number;
}

export interface RateLimitResponse {
  resources: {
    core: RateLimit;
    search: RateLimit;
    graphql?: RateLimit;
    integration_manifest?: RateLimit;
  };
  rate: RateLimit;
}

export interface ApiResponse<T> {
  data: T;
  rateLimit?: RateLimit;
  etag?: string;
}
import { test, expect, type Page, type Route } from "@playwright/test";

// ==============================================================================
// Shared mock setup helper — reused by all spec files
// ==============================================================================

export interface GitHubMockController {
  requests: string[];
  countRequests: (path: string) => number;
}

type GitHubRouteHandler = (route: Route) => Promise<void>;

function normalizeGitHubRequest(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function createRateLimitHeaders(limit: number, remaining: number): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 3600),
  };
}

async function fulfillJson(
  route: Route,
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers":
        "ETag, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function setupGitHubApiMocks(
  page: Page,
  handlers: Record<string, GitHubRouteHandler>
): Promise<GitHubMockController> {
  const requests: string[] = [];

  await page.route("https://api.github.com/**", async (route) => {
    const requestKey = normalizeGitHubRequest(route.request().url());
    requests.push(requestKey);

    const handler = handlers[requestKey];
    if (!handler) {
      throw new Error(
        `Unhandled GitHub API request in test: ${route.request().method()} ${requestKey}`
      );
    }

    await handler(route);
  });

  return {
    requests,
    countRequests: (path: string) => requests.filter((request) => request === path).length,
  };
}

export async function setupMocks(page: Page) {
  return setupGitHubApiMocks(page, {
    "/rate_limit": async (route) => {
      await fulfillJson(route, 200, {
        rate: {
          limit: 5000,
          remaining: 4999,
          reset: Math.floor(Date.now() / 1000) + 3600,
        },
      });
    },
    "/repos/test-owner/test-repo/branches": async (route) => {
      await fulfillJson(
        route,
        200,
        [{ name: "main" }, { name: "dev" }],
        createRateLimitHeaders(5000, 4998)
      );
    },
    "/repos/test-owner/test-repo/git/trees/main?recursive=1": async (route) => {
      await fulfillJson(
        route,
        200,
        {
          sha: "main-tree-sha",
          tree: [
            { path: "src", type: "tree", sha: "t1" },
            { path: "src/index.ts", type: "blob", sha: "f1", size: 1024 },
            { path: "src/utils.ts", type: "blob", sha: "f2", size: 2048 },
            { path: "src/f1.ts", type: "blob", sha: "f_1", size: 100 },
            { path: "src/f2.ts", type: "blob", sha: "f_2", size: 100 },
            { path: "src/f3.ts", type: "blob", sha: "f_3", size: 100 },
            { path: "src/f4.ts", type: "blob", sha: "f_4", size: 100 },
            { path: "src/f5.ts", type: "blob", sha: "f_5", size: 100 },
            { path: "src/f6.ts", type: "blob", sha: "f_6", size: 100 },
            { path: "src/f7.ts", type: "blob", sha: "f_7", size: 100 },
            { path: "src/f8.ts", type: "blob", sha: "f_8", size: 100 },
            { path: "src/f9.ts", type: "blob", sha: "f_9", size: 100 },
            { path: "src/f10.ts", type: "blob", sha: "f_10", size: 100 },
            { path: "docs", type: "tree", sha: "t2" },
            { path: "docs/README.md", type: "blob", sha: "f3", size: 512 },
          ],
          truncated: false,
        },
        createRateLimitHeaders(5000, 4997)
      );
    },
    "/repos/test-owner/test-repo/git/trees/dev?recursive=1": async (route) => {
      await fulfillJson(
        route,
        200,
        {
          sha: "dev-tree-sha",
          tree: [{ path: "dev-file.txt", type: "blob", sha: "dev-f1", size: 500 }],
          truncated: false,
        },
        createRateLimitHeaders(5000, 4996)
      );
    },
    "/repos/test-owner/test-repo/git/trees/abc1234?recursive=1": async (route) => {
      await fulfillJson(
        route,
        200,
        {
          sha: "abc1234",
          tree: [{ path: "sha-pinned-file.txt", type: "blob", sha: "sha-f1", size: 300 }],
          truncated: false,
        },
        createRateLimitHeaders(5000, 4995)
      );
    },
  });
}

// ==============================================================================
// Mock 403 for both branches + tree endpoints (simulates GitHub rate limit)
// ==============================================================================
export async function setup403Mocks(page: Page) {
  return setupGitHubApiMocks(page, {
    "/rate_limit": async (route) => {
      await fulfillJson(route, 200, {
        rate: { limit: 60, remaining: 0, reset: Math.floor(Date.now() / 1000) + 3600 },
      });
    },
    "/repos/test-owner/test-repo/branches": async (route) => {
      await fulfillJson(route, 403, {}, createRateLimitHeaders(60, 0));
    },
    "/repos/test-owner/test-repo/git/trees/main?recursive=1": async (route) => {
      await fulfillJson(route, 403, {}, createRateLimitHeaders(60, 0));
    },
  });
}

// ==============================================================================
// Helper: load a repo via the input form
// ==============================================================================
export async function loadRepo(page: Page, repo = "test-owner/test-repo") {
  await page.locator("input[placeholder*='owner'], input[placeholder*='用户名']").fill(repo);
  await page.locator("button[type='submit']").click();
}

// ==============================================================================
// Helper: set viewport to a mobile size (< md = 768px)
// ==============================================================================
export async function setMobileViewport(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
}

// ==============================================================================
// Helper: set viewport to a tablet size (md = 768px–1023px)
// ==============================================================================
export async function setTabletViewport(page: Page) {
  await page.setViewportSize({ width: 768, height: 1024 }); // iPad
}

// ==============================================================================
// Helper: set viewport to desktop size
// ==============================================================================
export async function setDesktopViewport(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
}

// ==============================================================================
// Helper: switch UI language via the LanguageSwitcher button
// ==============================================================================
export async function switchLanguage(page: Page, lang: "EN" | "ZH") {
  // The LanguageSwitcher renders buttons/links with the locale labels
  const btn = page.locator(`button:has-text("${lang}")`).or(
    page.locator(`[data-lang="${lang.toLowerCase()}"]`)
  ).first();
  await btn.click();
}

// ==============================================================================
// Helper: select README.md via checkbox in the tree
// ==============================================================================
export async function selectReadmeMd(page: Page) {
  await page.locator("text=docs").click();
  const checkbox = page
    .locator("div")
    .filter({ has: page.locator("span.truncate:text-is('README.md')") })
    .locator("button[role='checkbox']")
    .first();
  await checkbox.click();
}

// Re-export test/expect so individual spec files only need one import
export { test, expect };

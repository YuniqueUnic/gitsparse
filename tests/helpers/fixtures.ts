import { test, expect, Page } from "@playwright/test";

// ==============================================================================
// Shared mock setup helper — reused by all spec files
// ==============================================================================

export async function setupMocks(page: Page) {
  // Mock GitHub Rate Limit API
  await page.route("https://api.github.com/rate_limit", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rate: {
          limit: 5000,
          remaining: 4999,
          reset: Math.floor(Date.now() / 1000) + 3600,
        },
      }),
    });
  });

  // Mock Repository Branches API
  await page.route("https://api.github.com/repos/test-owner/test-repo/branches", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ name: "main" }, { name: "dev" }]),
    });
  });

  // Mock Repository Trees API (main branch)
  await page.route(
    "https://api.github.com/repos/test-owner/test-repo/git/trees/main?recursive=1",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
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
        }),
      });
    }
  );

  // Mock dev branch tree
  await page.route(
    "https://api.github.com/repos/test-owner/test-repo/git/trees/dev?recursive=1",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sha: "dev-tree-sha",
          tree: [{ path: "dev-file.txt", type: "blob", sha: "dev-f1", size: 500 }],
          truncated: false,
        }),
      });
    }
  );

  // Mock commit SHA abc1234 tree
  await page.route(
    "https://api.github.com/repos/test-owner/test-repo/git/trees/abc1234?recursive=1",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sha: "abc1234",
          tree: [{ path: "sha-pinned-file.txt", type: "blob", sha: "sha-f1", size: 300 }],
          truncated: false,
        }),
      });
    }
  );
}

export async function loadRepo(page: Page, repo = "test-owner/test-repo") {
  await page.locator("input[placeholder*='owner/repository']").fill(repo);
  await page.getByRole("button", { name: "Load Repository" }).click();
}

// Re-export test/expect so individual spec files only need one import
export { test, expect };

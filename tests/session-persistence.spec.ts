/**
 * TC-08 ~ TC-11: Session persistence, branch/SHA switching, and multi-pattern glob
 */
import { test, expect, setupMocks, loadRepo } from "./helpers/fixtures";

test.describe("Session: Persistence, Branch/SHA Switching & Multi-Pattern Glob", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("TC-08: Verify workspace and state auto-restoration from localStorage on refresh", async ({
    page,
  }) => {
    let githubApiRequestCount = 0;
    page.on("request", (request) => {
      if (request.url().startsWith("https://api.github.com/")) {
        githubApiRequestCount += 1;
      }
    });

    await loadRepo(page);
    await expect(page.locator("text=src")).toBeVisible();
    await expect(page.locator("footer")).toContainText("API Limit: 4997/5000");

    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();

    const checkbox = page
      .locator("div")
      .filter({ has: page.locator("span.truncate:text-is('README.md')") })
      .locator("button[role='checkbox']")
      .first();
    await checkbox.click();

    const globInput = page.locator("input[placeholder*='Filter files']");
    await globInput.fill("**/*.md");

    await expect(page.locator("text=Matches: 1 files")).toBeVisible();
    expect(githubApiRequestCount).toBe(2);

    // Reload and verify state restoration
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("input[placeholder*='owner/repository']")).toHaveValue(
      "test-owner/test-repo"
    );
    await expect(page.locator("text=docs").first()).toBeVisible();
    await expect(page.locator("footer")).toContainText("API Limit: 4997/5000");
    await expect(page.locator("input[placeholder*='Filter files']")).toHaveValue("**/*.md");
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();

    const restoredCheckbox = page
      .locator("div")
      .filter({ has: page.locator("span.truncate:text-is('README.md')") })
      .locator("button[role='checkbox']")
      .first();
    await expect(restoredCheckbox).toHaveAttribute("data-state", "checked");
    expect(githubApiRequestCount).toBe(2);
  });

  test("TC-08b: Verify legacy cached workspace refreshes quota status without refetching repo data", async ({
    page,
  }) => {
    const githubRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.startsWith("https://api.github.com/")) {
        const parsed = new URL(url);
        githubRequests.push(`${parsed.pathname}${parsed.search}`);
      }
    });

    await loadRepo(page);
    await expect(page.locator("text=src")).toBeVisible();
    await expect(page.locator("footer")).toContainText("API Limit: 4997/5000");

    await page.evaluate(() => {
      localStorage.removeItem("gitsparse_last_rate_limit_anon");
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("input[placeholder*='owner/repository']")).toHaveValue(
      "test-owner/test-repo"
    );
    await expect(page.locator("text=src")).toBeVisible();
    await expect(page.locator("footer")).toContainText("API Limit: 4999/5000");

    expect(githubRequests.filter((request) => request === "/rate_limit")).toHaveLength(1);
    expect(
      githubRequests.filter((request) => request === "/repos/test-owner/test-repo/branches")
    ).toHaveLength(1);
    expect(
      githubRequests.filter(
        (request) => request === "/repos/test-owner/test-repo/git/trees/main?recursive=1"
      )
    ).toHaveLength(1);
  });

  test("TC-09: Verify comma-separated multi-pattern Glob filtering", async ({ page }) => {
    await loadRepo(page);
    await expect(page.locator("text=src")).toBeVisible();

    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();

    const globInput = page.locator("input[placeholder*='Filter files']");
    await globInput.fill("src/*.ts,docs/*.md");

    await expect(page.locator("span.truncate:has-text('index.ts')").first()).toBeVisible();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();

    // Single pattern — only .md
    await globInput.fill("docs/*.md");
    await expect(page.locator("span.truncate:has-text('index.ts')")).not.toBeVisible();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();

    // Multi-pattern with spaces (real user input)
    await globInput.fill("src/*.ts, docs/*.md");
    await expect(page.locator("span.truncate:has-text('index.ts')").first()).toBeVisible();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();
  });

  test("TC-10: Verify branch switch via dropdown reloads the tree", async ({ page }) => {
    await loadRepo(page);
    await expect(page.locator("text=src")).toBeVisible();

    const selectTrigger = page.locator("button:has-text('main')").first();
    await selectTrigger.click();
    const devOption = page.locator("div[role='option']:has-text('dev')");
    await devOption.click();

    await expect(page.locator("text=dev-file.txt")).toBeVisible();
    await expect(page.locator("text=src")).not.toBeVisible();

    // Reload and verify branch persisted
    await page.reload();
    await expect(page.locator("text=dev-file.txt")).toBeVisible();
  });

  test("TC-11: Verify commit SHA switch reloads the tree with SHA-pinned content", async ({
    page,
  }) => {
    await loadRepo(page);
    await expect(page.locator("text=src")).toBeVisible();

    const shaTab = page
      .locator("button[role='tab']")
      .filter({ hasText: /Commit SHA/i })
      .first();
    await shaTab.click();

    const shaInput = page.locator("input[placeholder*='Commit SHA']");
    await shaInput.fill("abc1234");

    const applyBtn = page.getByRole("button", { name: /apply/i });
    await applyBtn.click();

    await expect(page.locator("text=sha-pinned-file.txt")).toBeVisible();
    await expect(page.locator("text=src")).not.toBeVisible();
  });
});

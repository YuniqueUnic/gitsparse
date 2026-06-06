/**
 * TC-01 ~ TC-03: Core tree loading and filtering features
 */
import { test, expect, setupMocks, loadRepo } from "./helpers/fixtures";

test.describe("Core: Repository Loading & File Tree", () => {
  let githubApi: Awaited<ReturnType<typeof setupMocks>>;

  test.beforeEach(async ({ page }) => {
    githubApi = await setupMocks(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("TC-01: Load repository and render the file tree", async ({ page }) => {
    await loadRepo(page);

    await expect(page.locator("text=Workspace: test-owner/test-repo")).toBeVisible();

    // Tree shows folders, files collapsed by default
    await expect(page.locator("text=src")).toBeVisible();
    await expect(page.locator("text=docs")).toBeVisible();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).not.toBeVisible();

    // Click folder to expand
    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();

    expect(githubApi.requests).toEqual([
      "/repos/test-owner/test-repo/branches",
      "/repos/test-owner/test-repo/git/trees/main?recursive=1",
    ]);
    expect(githubApi.countRequests("/rate_limit")).toBe(0);
  });

  test("TC-02: Switch branch and reload the tree", async ({ page }) => {
    await loadRepo(page);
    await expect(page.locator("text=src")).toBeVisible();

    const selectTrigger = page.locator("button:has-text('main')").first();
    await selectTrigger.click();

    const devOption = page.locator("div[role='option']:has-text('dev')");
    await devOption.click();

    await expect(page.locator("text=dev-file.txt")).toBeVisible();
    await expect(page.locator("text=src")).not.toBeVisible();
    expect(githubApi.countRequests("/repos/test-owner/test-repo/git/trees/dev?recursive=1")).toBe(1);
  });

  test("TC-03: Filter files using Glob matcher", async ({ page }) => {
    await loadRepo(page);

    // Expand docs
    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();
    await expect(page.locator("text=src")).toBeVisible();

    // Filter for only markdown files
    const globInput = page.locator("input[placeholder*='Filter files']");
    await globInput.fill("*.md");

    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();
    await expect(page.locator("text=index.ts")).not.toBeVisible();
  });
});

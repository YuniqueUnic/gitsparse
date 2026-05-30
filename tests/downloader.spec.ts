import { test, expect } from "@playwright/test";

test.describe("GitHub Direct Downloader E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock GitHub Rate Limit API
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

    // 2. Mock Repository Branches API
    await page.route("https://api.github.com/repos/test-owner/test-repo/branches", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { name: "main" },
          { name: "dev" }
        ]),
      });
    });

    // 3. Mock Repository Trees API (main branch)
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
              { path: "docs/README.md", type: "blob", sha: "f3", size: 512 }
            ],
            truncated: false,
          }),
        });
      }
    );

    // 4. Mock Repository Trees API (dev branch)
    await page.route(
      "https://api.github.com/repos/test-owner/test-repo/git/trees/dev?recursive=1",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            sha: "dev-tree-sha",
            tree: [
              { path: "dev-file.txt", type: "blob", sha: "dev-f1", size: 500 }
            ],
            truncated: false,
          }),
        });
      }
    );

    // Navigate to the app before each test
    await page.goto("/");
  });

  test("TC-01: Load repository and render the file tree", async ({ page }) => {
    // Input repository details
    const repoInput = page.locator("input[placeholder*='owner/repository']");
    await repoInput.fill("test-owner/test-repo");

    // Click Load Repository
    const loadBtn = page.getByRole("button", { name: "Load Repository" });
    await loadBtn.click();

    // Verify workspace text loaded
    await expect(page.locator("text=Workspace: test-owner/test-repo")).toBeVisible();

    // Verify tree view displays folders and files (collapsed by default)
    await expect(page.locator("text=src")).toBeVisible();
    await expect(page.locator("text=docs")).toBeVisible();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).not.toBeVisible();

    // Click folder to expand
    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();
  });

  test("TC-02: Switch branch and reload the tree", async ({ page }) => {
    // Load repository first
    await page.locator("input[placeholder*='owner/repository']").fill("test-owner/test-repo");
    await page.getByRole("button", { name: "Load Repository" }).click();
    await expect(page.locator("text=src")).toBeVisible();

    // Switch branch to dev
    const selectTrigger = page.locator("button:has-text('main')").first();
    await selectTrigger.click();

    const devOption = page.locator("div[role='option']:has-text('dev')");
    await devOption.click();

    // Verify that the tree updates to the dev tree
    await expect(page.locator("text=dev-file.txt")).toBeVisible();
    await expect(page.locator("text=src")).not.toBeVisible();
  });

  test("TC-03: Filter files using Glob matcher", async ({ page }) => {
    // Load repo
    await page.locator("input[placeholder*='owner/repository']").fill("test-owner/test-repo");
    await page.getByRole("button", { name: "Load Repository" }).click();
    
    // Expand docs
    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();
    await expect(page.locator("text=src")).toBeVisible();

    // Filter for only markdown files
    const globInput = page.locator("input[placeholder*='Filter files']");
    await globInput.fill("*.md");

    // Verify only markdown is matched and non-markdown hidden
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();
    await expect(page.locator("text=index.ts")).not.toBeVisible();
  });

  test("TC-04: Multi-file script preview and generation", async ({ page }) => {
    // Load repo
    await page.locator("input[placeholder*='owner/repository']").fill("test-owner/test-repo");
    await page.getByRole("button", { name: "Load Repository" }).click();

    // Expand docs
    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();

    // Select README.md checkbox
    const checkbox = page.locator("div").filter({ has: page.locator("span.truncate:text-is('README.md')") }).locator("button[role='checkbox']").first();
    await checkbox.click();

    // Verify script generation section appears on the right
    await expect(page.locator("text=Multi-file Download Script")).toBeVisible();
    await expect(page.locator("text=Generating localized script for 1 files")).toBeVisible();

    // Verify bash code content contains correct raw github curl link
    const previewContent = page.locator("pre");
    await expect(previewContent).toContainText("curl -L");
    await expect(previewContent).toContainText("https://raw.githubusercontent.com/test-owner/test-repo/refs/heads/main/docs/README.md");
  });

  test("TC-05: Toggle download tool to wget and verify command replacement", async ({ page }) => {
    // 1. Load Repository
    await page.locator("input[placeholder*='owner/repository']").fill("test-owner/test-repo");
    await page.getByRole("button", { name: "Load Repository" }).click();

    // 2. Expand docs and select README.md checkbox
    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();
    
    const checkbox = page.locator("div").filter({ has: page.locator("span.truncate:text-is('README.md')") }).locator("button[role='checkbox']").first();
    await checkbox.click();

    // 3. Verify default is curl
    const previewContainer = page.locator("pre");
    await expect(previewContainer).toContainText("curl -L");

    // 4. Toggle switcher to wget
    const wgetTab = page.locator("button[role='tab']").filter({ hasText: /^wget$/ });
    await wgetTab.click();

    // 5. Verify script is replaced with wget syntax
    await expect(previewContainer).toContainText("wget -O");
    await expect(previewContainer).toContainText("mkdir -p");
    await expect(previewContainer).not.toContainText("curl -L");

    // 6. Clear selection to test single-file click toggle
    await page.getByTitle("Clear selection").click();
    await page.locator("span.truncate:has-text('README.md')").first().click();

    // 7. Toggle to curl to verify click-mode switching
    await page.locator("button[role='tab']").filter({ hasText: /^curl$/ }).click();

    // 8. Verify single file command switches to curl
    const codeArea = page.locator("pre");
    await expect(codeArea).toContainText("curl -L");

    // 9. Toggle to wget again
    await page.locator("button[role='tab']").filter({ hasText: /^wget$/ }).click();

    // 10. Verify command replaced with single-file wget command in full script
    await expect(codeArea).toContainText("mkdir -p \"$OUTPUT_DIR/$(dirname \"docs/README.md\")\"");
    await expect(codeArea).toContainText("wget -O \"$OUTPUT_DIR/docs/README.md\"");
    await expect(codeArea).not.toContainText("curl -L");
  });

  test("TC-06: Verify shell script -y/--yes argument parsing and interactive confirmation", async ({ page }) => {
    // 1. Load Repository
    await page.locator("input[placeholder*='owner/repository']").fill("test-owner/test-repo");
    await page.getByRole("button", { name: "Load Repository" }).click();

    // 2. Select README.md checkbox
    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();
    
    const checkbox = page.locator("div").filter({ has: page.locator("span.truncate:text-is('README.md')") }).locator("button[role='checkbox']").first();
    await checkbox.click();

    // 3. Verify bash code contains y/N read prompt and parameter loop
    const codeArea = page.locator("pre");
    await expect(codeArea).toContainText("BYPASS_CONFIRM=false");
    await expect(codeArea).toContainText("-y|--yes)");
    await expect(codeArea).toContainText("BYPASS_CONFIRM=true");
    await expect(codeArea).toContainText("will be download into");
    await expect(codeArea).toContainText("[y/N], default N?");
  });

  test("TC-07: Verify dual-mode tips dialog, auto-suggest modal, and Git Sparse checkout generation", async ({ page }) => {
    // 1. Verify Tips button opens comparison dialog
    const tipsBtn = page.getByRole("button", { name: "Tips" });
    await expect(tipsBtn).toBeVisible();
    await tipsBtn.click();
    
    // Check if dialog is visible
    await expect(page.locator("text=Download Engine Comparison").first()).toBeVisible();
    await expect(page.locator("text=Direct HTTP Mode").first()).toBeVisible();
    await expect(page.locator("text=Git Sparse Mode").first()).toBeVisible();
    await expect(page.locator("text=sparse-checkout").first()).toBeVisible();
    
    // Close the dialog
    await page.getByRole("button", { name: "I Understand" }).click();
    await expect(page.locator("text=Download Engine Comparison")).not.toBeVisible();

    // 2. Load Repository
    await page.locator("input[placeholder*='owner/repository']").fill("test-owner/test-repo");
    await page.getByRole("button", { name: "Load Repository" }).click();

    // Expand src
    await page.locator("text=src").first().click();

    // Filter src files to match 12 files
    const globInput = page.locator("input[placeholder*='Filter files']");
    await globInput.fill("src/*");

    // Click select all matched files (will select 12 files)
    const selectAllBtn = page.getByRole("button", { name: "Select all matching files" });
    await selectAllBtn.click();

    // 3. Verify that SuggestDialog modal automatically pops up
    await expect(page.locator("text=Switch to High Performance Mode?")).toBeVisible();
    await expect(page.locator("text=You have selected more than 10 files")).toBeVisible();

    // 4. Click Switch Mode in dialog
    const switchBtn = page.getByRole("button", { name: "Switch Mode" });
    await switchBtn.click();
    await expect(page.locator("text=Switch to High Performance Mode?")).not.toBeVisible();

    // 5. Verify script code generated is Git Sparse checkout script
    const previewContainer = page.locator("pre");
    await expect(previewContainer).toContainText("git config core.sparseCheckout true");
    await expect(previewContainer).toContainText("git sparse-checkout set");
    await expect(previewContainer).toContainText("--filter=blob:none");
    await expect(page.locator("text=gitsparse.sh PREVIEW")).toBeVisible();
  });

  test("TC-08: Verify workspace and state auto-restoration from localStorage on refresh", async ({ page }) => {
    // 1. Load Repository
    await page.locator("input[placeholder*='owner/repository']").fill("test-owner/test-repo");
    await page.getByRole("button", { name: "Load Repository" }).click();
    await expect(page.locator("text=src")).toBeVisible();

    // 2. Expand docs and select README.md checkbox
    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();
    
    const checkbox = page.locator("div").filter({ has: page.locator("span.truncate:text-is('README.md')") }).locator("button[role='checkbox']").first();
    await checkbox.click();

    // 3. Input glob matching filter
    const globInput = page.locator("input[placeholder*='Filter files']");
    await globInput.fill("**/*.md");
    
    // Verify matches and state
    await expect(page.locator("text=Matches: 1 files")).toBeVisible();

    // 4. Reload page (E2E Refresh)
    await page.reload();

    // 5. Verify page automatically restores all session states!
    // Verify input backfill
    await expect(page.locator("input[placeholder*='owner/repository']")).toHaveValue("test-owner/test-repo");
    
    // Verify tree auto-loaded
    await expect(page.locator("text=src").first()).toBeVisible();
    await expect(page.locator("text=docs").first()).toBeVisible();

    // Verify glob pattern auto-restored
    await expect(page.locator("input[placeholder*='Filter files']")).toHaveValue("**/*.md");

    // Verify checked checkboxes auto-restored!
    const restoredCheckbox = page.locator("div").filter({ has: page.locator("span.truncate:text-is('README.md')") }).locator("button[role='checkbox']").first();
    await expect(restoredCheckbox).toHaveAttribute("data-state", "checked");
  });
});

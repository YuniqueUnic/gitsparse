/**
 * TC-07, TC-13, TC-14: Git Sparse checkout script generation
 */
import { test, expect, setupMocks, loadRepo } from "./helpers/fixtures";

test.describe("Git Sparse: Script Generation & Directory Aggregation", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("TC-07: Verify dual-mode tips dialog, auto-suggest modal, and Git Sparse checkout generation", async ({
    page,
  }) => {
    // Tips dialog
    const tipsBtn = page.getByRole("button", { name: "Tips" });
    await expect(tipsBtn).toBeVisible();
    await tipsBtn.click();

    await expect(page.locator("text=Download Engine Comparison").first()).toBeVisible();
    await expect(page.locator("text=Direct HTTP Mode").first()).toBeVisible();
    await expect(page.locator("text=Git Sparse Mode").first()).toBeVisible();
    await expect(page.locator("text=sparse-checkout").first()).toBeVisible();

    await page.getByRole("button", { name: "I Understand" }).click();
    await expect(page.locator("text=Download Engine Comparison")).not.toBeVisible();

    // Load repo and expand src
    await loadRepo(page);
    await page.locator("text=src").first().click();

    const globInput = page.locator("input[placeholder*='Filter files']");
    await globInput.fill("src/*");

    const selectAllBtn = page.getByRole("button", { name: "Select all matching files" });
    await selectAllBtn.click();

    // Auto-suggest modal for >10 files
    await expect(page.locator("text=Switch to High Performance Mode?")).toBeVisible();
    await expect(page.locator("text=You have selected more than 10 files")).toBeVisible();

    const switchBtn = page.getByRole("button", { name: "Switch Mode" });
    await switchBtn.click();
    await expect(page.locator("text=Switch to High Performance Mode?")).not.toBeVisible();

    // Verify sparse checkout script
    const previewContainer = page.locator("pre");
    await expect(previewContainer).toContainText("git config core.sparseCheckout true");
    await expect(previewContainer).toContainText("git sparse-checkout set");
    await expect(previewContainer).toContainText("--filter=blob:none");
    await expect(page.locator("text=gitsparse.sh PREVIEW")).toBeVisible();
  });

  test("TC-13: Sparse mode uses directory path (not individual files) when full dir is selected", async ({
    page,
  }) => {
    await loadRepo(page);

    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();

    const checkbox = page
      .locator("div")
      .filter({ has: page.locator("span.truncate:text-is('README.md')") })
      .locator("button[role='checkbox']")
      .first();
    await checkbox.click();

    // Switch to Git Sparse mode
    const sparseTab = page.locator("button").filter({ hasText: "Git Sparse" }).first();
    await sparseTab.click();

    // Script should use "docs" directory path, not individual files
    const scriptPreview = page.locator("pre");
    await expect(scriptPreview).toContainText('"docs"');

    const scriptText = await scriptPreview.textContent();
    expect(scriptText).toBeTruthy();
    expect(scriptText).toContain('"docs"');

    // No rm cleanup block for full directory selection
    expect(scriptText).not.toContain("Cleaning up unselected files");
  });

  test("TC-14: Sparse mode adds rm cleanup block when only partial directory is selected", async ({
    page,
  }) => {
    await loadRepo(page);

    const treeSection = page.locator("section").nth(1);
    await expect(treeSection.locator("span.truncate", { hasText: "src" }).first()).toBeVisible();
    await expect(page.locator("button[role='checkbox'][data-state='checked']")).toHaveCount(0);

    // Expand src
    await treeSection.locator("span.truncate", { hasText: "src" }).first().click();
    await expect(treeSection.locator("span.truncate", { hasText: "index.ts" }).first()).toBeVisible();

    // Select ONLY index.ts (partial — src has 12 files)
    const indexTsSpan = treeSection.locator("span.truncate", { hasText: "index.ts" }).first();
    const indexTsCheckbox = indexTsSpan
      .locator("..")
      .locator("..")
      .locator("..")
      .locator("button[role='checkbox']")
      .first();
    await indexTsCheckbox.click();
    await expect(indexTsCheckbox).toHaveAttribute("data-state", "checked");

    // Switch to Git Sparse mode
    const sparseTab = page.locator("button").filter({ hasText: "Git Sparse" }).first();
    await sparseTab.click();

    const scriptPanel = page.locator("text=gitsparse.sh PREVIEW").locator("..").locator("..");
    await expect(scriptPanel).toBeVisible();
    const scriptText = await scriptPanel.textContent();
    expect(scriptText).toBeTruthy();

    // Uses "src" directory path
    expect(scriptText).toContain("src");

    // Has rm cleanup for unselected files
    expect(scriptText).toContain("Cleaning up unselected files");
    expect(scriptText).toContain("src/utils.ts");

    // Cleans up empty dirs
    expect(scriptText).toContain("find . -type d -empty");
  });
});

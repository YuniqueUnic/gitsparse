/**
 * TC-12, TC-12b: Usage Tips dialog — step verification and mode-specific content
 */
import { test, expect, setupMocks, loadRepo } from "./helpers/fixtures";

test.describe("Usage Tips Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  async function selectReadme(page: Parameters<typeof loadRepo>[0]) {
    await loadRepo(page);
    await expect(page.locator("text=src")).toBeVisible();

    await page.locator("text=docs").click();
    const checkbox = page
      .locator("div")
      .filter({ has: page.locator("span.truncate:text-is('README.md')") })
      .locator("button[role='checkbox']")
      .first();
    await checkbox.click();
  }

  test("TC-12: Usage Tips modal opens, shows timeline steps, and has copyable code snippets", async ({
    page,
  }) => {
    await selectReadme(page);

    const usageBtn = page.getByRole("button", { name: /usage/i });
    await expect(usageBtn).toBeVisible();
    await usageBtn.click();

    const dialog = page.locator("div[role='dialog']");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("text=How to Use")).toBeVisible();

    // All 6 Direct HTTP timeline steps
    await expect(dialog.locator("text=Locate the downloaded script")).toBeVisible();
    await expect(dialog.locator("text=Make the script executable")).toBeVisible();
    await expect(dialog.locator("text=Run the script")).toBeVisible();
    await expect(dialog.locator("text=Specify an output directory")).toBeVisible();
    await expect(dialog.locator("text=Skip the confirmation prompt")).toBeVisible();
    await expect(dialog.locator("text=Access private repos or avoid rate limits")).toBeVisible();

    // Code snippet content
    await expect(dialog.locator("pre").filter({ hasText: "chmod +x gitsparse.sh" }).first()).toBeVisible();
    await expect(dialog.locator("pre").filter({ hasText: "bash ./gitsparse.sh" }).first()).toBeVisible();
    await expect(dialog.locator("pre").filter({ hasText: "-o" }).first()).toBeVisible();
    await expect(dialog.locator("pre").filter({ hasText: "GITHUB_PAT" }).first()).toBeVisible();

    // Copy button appears on hover
    const firstDialogPre = dialog.locator("pre").first();
    await firstDialogPre.hover();
    const copyBtn = dialog.locator(".group button").first();
    await expect(copyBtn).toBeVisible();

    // Close
    await dialog.getByRole("button", { name: "Got it" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("TC-12b: Usage Tips modal shows Git Sparse-specific step 7 when in Sparse mode", async ({
    page,
  }) => {
    await selectReadme(page);

    // Switch to Git Sparse mode
    const sparseTab = page.locator("button").filter({ hasText: "Git Sparse" }).first();
    await sparseTab.click();

    await page.getByRole("button", { name: /usage/i }).click();
    const dialog = page.locator("div[role='dialog']");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("text=How to Use")).toBeVisible();

    // Sparse mode badge
    await expect(dialog.locator("text=Git Sparse Mode").first()).toBeVisible();

    // Step 7 (git prereqs) only in Sparse mode
    await expect(dialog.locator("text=Git Sparse mode prerequisites")).toBeVisible();
    await expect(dialog.locator("pre").filter({ hasText: "git --version" }).first()).toBeVisible();

    await dialog.getByRole("button", { name: "Got it" }).click();
    await expect(dialog).not.toBeVisible();
  });
});

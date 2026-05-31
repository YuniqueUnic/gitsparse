/**
 * TC-04 ~ TC-06: Direct HTTP download script generation and script flags
 */
import { test, expect, setupMocks, loadRepo } from "./helpers/fixtures";

test.describe("Direct Download: Script Generation & Flags", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("TC-04: Multi-file script preview and generation", async ({ page }) => {
    await loadRepo(page);

    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();

    const checkbox = page
      .locator("div")
      .filter({ has: page.locator("span.truncate:text-is('README.md')") })
      .locator("button[role='checkbox']")
      .first();
    await checkbox.click();

    await expect(page.locator("text=Multi-file Download Script")).toBeVisible();
    await expect(page.locator("text=Generating localized script for 1 files")).toBeVisible();

    const previewContent = page.locator("pre");
    await expect(previewContent).toContainText("curl -L");
    await expect(previewContent).toContainText(
      "https://raw.githubusercontent.com/test-owner/test-repo/refs/heads/main/docs/README.md"
    );
  });

  test("TC-05: Toggle download tool to wget and verify command replacement", async ({ page }) => {
    await loadRepo(page);

    await page.locator("text=docs").click();
    await expect(page.locator("span.truncate:has-text('README.md')").first()).toBeVisible();

    const checkbox = page
      .locator("div")
      .filter({ has: page.locator("span.truncate:text-is('README.md')") })
      .locator("button[role='checkbox']")
      .first();
    await checkbox.click();

    // Default is curl
    const previewContainer = page.locator("pre");
    await expect(previewContainer).toContainText("curl -L");

    // Toggle to wget
    const wgetTab = page.locator("button[role='tab']").filter({ hasText: /^wget$/ });
    await wgetTab.click();

    await expect(previewContainer).toContainText("wget -O");
    await expect(previewContainer).toContainText("mkdir -p");
    await expect(previewContainer).not.toContainText("curl -L");

    // Clear selection and test single-file click toggle
    await page.getByTitle("Clear selection").click();
    await page.locator("span.truncate:has-text('README.md')").first().click();

    await page.locator("button[role='tab']").filter({ hasText: /^curl$/ }).click();

    const codeArea = page.locator("pre");
    await expect(codeArea).toContainText("curl -L");

    // Toggle to wget again
    await page.locator("button[role='tab']").filter({ hasText: /^wget$/ }).click();

    await expect(codeArea).toContainText('mkdir -p "$OUTPUT_DIR/$(dirname "docs/README.md")"');
    await expect(codeArea).toContainText('wget -O "$OUTPUT_DIR/docs/README.md"');
    await expect(codeArea).not.toContainText("curl -L");
  });

  test("TC-06: Verify shell script -y/--yes argument parsing and interactive confirmation", async ({
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

    const codeArea = page.locator("pre");
    await expect(codeArea).toContainText("BYPASS_CONFIRM=false");
    await expect(codeArea).toContainText("-y|--yes)");
    await expect(codeArea).toContainText("BYPASS_CONFIRM=true");
    await expect(codeArea).toContainText("will be download into");
    await expect(codeArea).toContainText("[y/N], default N?");
  });
});

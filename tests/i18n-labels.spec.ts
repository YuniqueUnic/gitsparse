/**
 * BDD: i18n Button Labels & Preview Tag
 *
 * Feature: All UI text is served through the i18n system
 *   As a user
 *   I want every button and label to honour my selected language
 *   So that the interface feels native regardless of locale
 */
import {
  test,
  expect,
  setupMocks,
  loadRepo,
  selectReadmeMd,
} from "./helpers/fixtures";

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------
const LOCALE_KEY = "gitsparse_locale";

test.describe("Feature: i18n button labels and preview tag", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  // -------------------------------------------------------------------------
  // Scenario: Usage button renders localised text in English
  // -------------------------------------------------------------------------
  test("Scenario: Usage button renders localised text in English (EN default)", async ({ page }) => {
    // Given the locale is English (default)
    await page.evaluate((key) => localStorage.removeItem(key), LOCALE_KEY);

    // And a repo is loaded and a file is selected
    await loadRepo(page);
    await selectReadmeMd(page);

    // When I look at the action buttons in the script preview panel
    const usageBtn = page.getByRole("button", { name: /^Usage$/i });

    // Then the Usage button is visible with the English label
    await expect(usageBtn).toBeVisible();
    await expect(usageBtn).toContainText("Usage");
  });

  // -------------------------------------------------------------------------
  // Scenario: Usage button renders localised text in Chinese
  // -------------------------------------------------------------------------
  test("Scenario: Usage button renders localised text in Chinese (ZH)", async ({ page }) => {
    // Given the locale is set to Chinese before navigation
    await page.addInitScript((key) => {
      localStorage.setItem(key, "zh");
    }, LOCALE_KEY);

    // And a repo is loaded and a file is selected
    await loadRepo(page);
    await selectReadmeMd(page);

    // When I look at the action buttons in the script preview panel
    const usageBtn = page.getByRole("button", { name: /使用说明/ });

    // Then the Usage button shows the Chinese label
    await expect(usageBtn).toBeVisible();
    await expect(usageBtn).toContainText("使用说明");
  });

  // -------------------------------------------------------------------------
  // Scenario: PREVIEW label is rendered through i18n (English)
  // -------------------------------------------------------------------------
  test("Scenario: PREVIEW terminal label is rendered via i18n in English", async ({ page }) => {
    // Given the locale is English and a repo is loaded
    await loadRepo(page);
    await selectReadmeMd(page);

    // When I inspect the script preview terminal header bar
    const previewBar = page.locator("div.uppercase.tracking-widest");

    // Then it contains the i18n PREVIEW label
    await expect(previewBar).toContainText("PREVIEW");
    // And it is NOT just a hardcoded empty string or missing
    await expect(previewBar).not.toBeEmpty();
  });

  // -------------------------------------------------------------------------
  // Scenario: PREVIEW label renders in Chinese
  // -------------------------------------------------------------------------
  test("Scenario: PREVIEW terminal label renders as '预览' in Chinese", async ({ page }) => {
    // Given the locale is Chinese
    await page.addInitScript((key) => {
      localStorage.setItem(key, "zh");
    }, LOCALE_KEY);

    await loadRepo(page);
    await selectReadmeMd(page);

    // When I look at the terminal header bar
    const previewBar = page.locator("div.uppercase.tracking-widest");

    // Then it shows the Chinese label
    await expect(previewBar).toContainText("预览");
  });

  // -------------------------------------------------------------------------
  // Scenario: Usage button tooltip (title) is i18n-aware
  // -------------------------------------------------------------------------
  test("Scenario: Usage button title attribute is i18n-aware in English", async ({ page }) => {
    // Given English locale and a selection is made
    await loadRepo(page);
    await selectReadmeMd(page);

    // When I query the Usage button's accessible title
    const usageBtn = page.getByRole("button", { name: /^Usage$/i });

    // Then it has the correct title text from i18n
    await expect(usageBtn).toHaveAttribute("title", "How to use this script");
  });

  // -------------------------------------------------------------------------
  // Scenario: Usage dialog title is i18n-aware
  // -------------------------------------------------------------------------
  test("Scenario: Clicking Usage button opens the dialog with i18n title", async ({ page }) => {
    // Given the locale is English and a file is selected
    await loadRepo(page);
    await selectReadmeMd(page);

    // When I click the Usage button
    await page.getByRole("button", { name: /^Usage$/i }).click();

    // Then the dialog opens with the i18n title text
    const dialog = page.locator("div[role='dialog']");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("text=How to Use")).toBeVisible();

    // And the close button uses i18n
    await expect(dialog.getByRole("button", { name: "Got it" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Usage dialog close button is i18n-aware in Chinese
  // -------------------------------------------------------------------------
  test("Scenario: Usage dialog close button shows '知道了' in Chinese", async ({ page }) => {
    // Given the locale is Chinese
    await page.addInitScript((key) => {
      localStorage.setItem(key, "zh");
    }, LOCALE_KEY);

    await loadRepo(page);
    await selectReadmeMd(page);

    // When I open the Usage dialog
    await page.getByRole("button", { name: /使用说明/ }).click();

    // Then the close button shows the Chinese label
    const dialog = page.locator("div[role='dialog']");
    await expect(dialog.getByRole("button", { name: "知道了" })).toBeVisible();
  });
});

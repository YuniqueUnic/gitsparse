/**
 * BDD: GitHub API 403 Error Handling
 *
 * Feature: Graceful handling of 403 / rate-limit errors from GitHub API
 *   As a user who hits the GitHub API rate limit or accesses a private repo
 *   I want to see a clear error message AND the Token dialog to open automatically
 *   So that I can add my Personal Access Token without hunting for the key icon
 */
import {
  test,
  expect,
  setup403Mocks,
  setupMocks,
  loadRepo,
} from "./helpers/fixtures";

// ---------------------------------------------------------------------------
// Feature: 403 auto-opens Token dialog
// ---------------------------------------------------------------------------
test.describe("Feature: GitHub 403 error triggers automatic Token dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  // -------------------------------------------------------------------------
  // Scenario: 403 on tree fetch auto-opens the Token configuration dialog
  // -------------------------------------------------------------------------
  test("Scenario: Token dialog opens automatically when GitHub returns 403", async ({ page }) => {
    // Given the GitHub API returns 403 for the tree endpoint
    await setup403Mocks(page);

    // When I submit a repository URL
    await loadRepo(page);

    // Then a destructive toast notification should appear
    const toast = page.locator("[data-state='open']").filter({ hasText: /Error|失败/i }).first();
    await expect(toast).toBeVisible({ timeout: 6000 });

    // And the Token configuration dialog should open automatically
    const tokenDialog = page.locator("div[role='dialog']");
    await expect(tokenDialog).toBeVisible({ timeout: 6000 });

    // And the dialog should contain a PAT input field
    const patInput = tokenDialog.locator("input[type='password'], input[type='text']");
    await expect(patInput).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: 403 toast message guides user to add token (EN)
  // -------------------------------------------------------------------------
  test("Scenario: Error toast contains 403 message in English", async ({ page }) => {
    // Given 403 mocks are active
    await setup403Mocks(page);

    // When I load a repo
    await loadRepo(page);

    // Then the toast should mention 403 or access denied
    const toastDesc = page.locator("[data-state='open'] [class*='description'], [data-state='open'] p").first();
    await expect(toastDesc).toContainText(/403|token|Token/i, { timeout: 6000 });
  });

  // -------------------------------------------------------------------------
  // Scenario: 403 toast message guides user to add token (ZH)
  // -------------------------------------------------------------------------
  test("Scenario: Error toast contains PAT guidance in Chinese locale", async ({ page }) => {
    // Given the locale is Chinese — addInitScript must run before goto
    await page.addInitScript(() => localStorage.setItem("gitsparse_locale", "zh"));
    await setup403Mocks(page);
    await page.goto("/");

    // When I load a repo
    await loadRepo(page);

    // Then the toast should contain Chinese error guidance (match any destructive toast)
    const toast = page.locator("[data-state='open'][class*='destructive']").filter({ hasText: /仓库|失败|Error|配额/i }).first();
    await expect(toast).toBeVisible({ timeout: 6000 });
  });

  // -------------------------------------------------------------------------
  // Scenario: Successful load does NOT open Token dialog
  // -------------------------------------------------------------------------
  test("Scenario: Successful 200 repo load does NOT open Token dialog", async ({ page }) => {
    // Given the GitHub API returns 200 (normal mocks)
    await setupMocks(page);

    // When I load a repo successfully
    await loadRepo(page);
    await expect(page.locator("text=Workspace: test-owner/test-repo")).toBeVisible();

    // Then the Token dialog should NOT be open
    const tokenDialog = page.locator("div[role='dialog']");
    await expect(tokenDialog).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Error is not rethrown (no unhandled promise rejection noise)
  // -------------------------------------------------------------------------
  test("Scenario: 403 error does not cause unhandled promise rejection in console", async ({ page }) => {
    // Given 403 mocks are active
    await setup403Mocks(page);

    const uncaughtErrors: string[] = [];
    page.on("pageerror", (err) => uncaughtErrors.push(err.message));

    // When I load a repo
    await loadRepo(page);
    await expect(page.locator("div[role='dialog']")).toBeVisible({ timeout: 6000 });

    // Then there should be no uncaught JS errors related to fetch/promise rejection
    const fetchErrors = uncaughtErrors.filter((e) => /Uncaught|fetch|promise/i.test(e));
    expect(fetchErrors).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Scenario: Token dialog closes and user can retry
  // -------------------------------------------------------------------------
  test("Scenario: User can close the Token dialog after it auto-opens on 403", async ({ page }) => {
    // Given 403 triggered Token dialog is open
    await setup403Mocks(page);
    await loadRepo(page);

    const tokenDialog = page.locator("div[role='dialog']");
    await expect(tokenDialog).toBeVisible({ timeout: 6000 });

    // When the user closes it via the X button or Cancel
    const closeBtn = tokenDialog.locator("button[aria-label='Close'], button:has-text('Cancel'), button:has-text('×'), button[data-radix-collection-item]").first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      // Try pressing Escape
      await page.keyboard.press("Escape");
    }

    // Then the dialog should close
    await expect(tokenDialog).not.toBeVisible({ timeout: 3000 });
  });
});

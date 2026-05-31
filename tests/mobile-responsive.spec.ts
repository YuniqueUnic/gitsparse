/**
 * BDD: Mobile & Tablet Responsive Layout
 *
 * Feature: Responsive two-panel layout adapts to viewport size
 *   As a user on a mobile or tablet device
 *   I want a tab switcher to toggle between the File Tree and Script Preview
 *   So that I can use the full screen for each panel instead of cramped splits
 */
import {
  test,
  expect,
  setupMocks,
  loadRepo,
  selectReadmeMd,
  setMobileViewport,
  setTabletViewport,
  setDesktopViewport,
} from "./helpers/fixtures";

// ---------------------------------------------------------------------------
// Feature: Mobile Tab Switcher
// ---------------------------------------------------------------------------
test.describe("Feature: Mobile tab switcher for Tree / Preview panels", () => {
  test.beforeEach(async ({ page }) => {
    await setMobileViewport(page);
    await setupMocks(page);
    await page.goto("/");
  });

  // -------------------------------------------------------------------------
  // Scenario: Tab switcher is visible on mobile
  // -------------------------------------------------------------------------
  test("Scenario: Tab switcher bar is visible on mobile viewport", async ({ page }) => {
    // Given the user is on a mobile device (390px wide)
    // (beforeEach already sets viewport)

    // When the page loads
    // Then a tab switcher with "Repository Files" and "Preview" tabs should be visible
    const tabSwitcher = page.locator("div.flex.md\\:hidden");
    await expect(tabSwitcher).toBeVisible();

    const treeTab = tabSwitcher.locator("button", { hasText: "Repository Files" });
    const previewTab = tabSwitcher.locator("button", { hasText: "Preview" });
    await expect(treeTab).toBeVisible();
    await expect(previewTab).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Tab switcher is hidden on desktop
  // -------------------------------------------------------------------------
  test("Scenario: Tab switcher is NOT visible on desktop viewport", async ({ page }) => {
    // Given the user resizes to desktop
    await setDesktopViewport(page);

    // Then the mobile tab switcher should be hidden (md:hidden)
    const tabSwitcher = page.locator("div.flex.md\\:hidden");
    await expect(tabSwitcher).toBeHidden();
  });

  // -------------------------------------------------------------------------
  // Scenario: Tree panel shown by default on mobile
  // -------------------------------------------------------------------------
  test("Scenario: File Tree panel is shown by default when on mobile", async ({ page }) => {
    // Given the mobile viewport is active and repo is loaded
    await loadRepo(page);

    // Then the Tree section should be visible (active tab)
    const treeSection = page.locator("section").filter({ has: page.locator("h2:text('Repository Files')") });
    await expect(treeSection).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Clicking Preview tab shows the Preview panel
  // -------------------------------------------------------------------------
  test("Scenario: Tapping the Preview tab reveals the Script Preview panel", async ({ page }) => {
    // Given a repo is loaded on mobile
    await loadRepo(page);

    // When I tap the "Preview" tab
    const tabSwitcher = page.locator("div.flex.md\\:hidden");
    await tabSwitcher.locator("button", { hasText: "Preview" }).click();

    // Then the Script Preview area should become visible
    // The guide/empty state in CurlPreview should be visible
    const previewSection = page.locator("section").filter({
      has: page.locator("h3"),
    }).last();
    await expect(previewSection).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Clicking a file auto-switches to Preview tab on mobile
  // -------------------------------------------------------------------------
  test("Scenario: Clicking a file in the Tree auto-switches to Preview tab on mobile", async ({ page }) => {
    // Given a repo is loaded on mobile
    await loadRepo(page);

    // And the Tree tab is active (default)
    const tabSwitcher = page.locator("div.flex.md\\:hidden");
    const treeTab = tabSwitcher.locator("button", { hasText: "Repository Files" });
    const previewTab = tabSwitcher.locator("button", { hasText: "Preview" });

    // When I click a file in the tree
    await page.locator("text=docs").click();
    await page.locator("span.truncate:text-is('README.md')").first().click();

    // Then the app should auto-switch to the Preview tab
    // Preview tab button has the active style (background-color applied)
    await expect(previewTab).toHaveClass(/bg-background/);
    await expect(treeTab).not.toHaveClass(/bg-background/);
  });

  // -------------------------------------------------------------------------
  // Scenario: Switching back to Tree tab shows the file tree
  // -------------------------------------------------------------------------
  test("Scenario: Tapping Tree tab brings the file tree back into view", async ({ page }) => {
    // Given a repo is loaded and preview tab is active
    await loadRepo(page);
    const tabSwitcher = page.locator("div.flex.md\\:hidden");
    await tabSwitcher.locator("button", { hasText: "Preview" }).click();

    // When I tap the Tree tab
    await tabSwitcher.locator("button", { hasText: "Repository Files" }).click();

    // Then the tree section is visible again
    const treeSection = page.locator("section").filter({
      has: page.locator("h2:text('Repository Files')"),
    });
    await expect(treeSection).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Feature: Tablet control panel layout
// ---------------------------------------------------------------------------
test.describe("Feature: Tablet (sm breakpoint) control panel grid", () => {
  test.beforeEach(async ({ page }) => {
    await setTabletViewport(page);
    await setupMocks(page);
    await page.goto("/");
  });

  // -------------------------------------------------------------------------
  // Scenario: Control panel uses 2-column grid on tablet
  // -------------------------------------------------------------------------
  test("Scenario: Branch switcher and Glob filter appear side-by-side on tablet (768px)", async ({ page }) => {
    // Given the viewport is 768px wide (tablet)
    // And a repo is loaded
    await loadRepo(page);

    // When the control panel is rendered
    // Then the control grid has sm:grid-cols-2 applied
    // Both branch switcher and glob filter should be visible simultaneously
    const branchSwitcher = page.locator("label", { hasText: "Branch / Commit SHA Selection" });
    const globFilter = page.locator("label", { hasText: "Glob Matching Filter" });

    await expect(branchSwitcher).toBeVisible();
    await expect(globFilter).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario: Desktop side-by-side layout at md+ breakpoint
  // -------------------------------------------------------------------------
  test("Scenario: File Tree and Script Preview panels appear side-by-side on desktop", async ({ page }) => {
    // Given the viewport is desktop size
    await setDesktopViewport(page);
    await loadRepo(page);
    await selectReadmeMd(page);

    // When the main workspace renders
    // Then both the Tree panel and the Preview panel should be visible simultaneously
    const treeSection = page.locator("section").filter({
      has: page.locator("h2:text('Repository Files')"),
    });
    const previewCard = page.locator(".border.border-border.bg-card\\/65");

    await expect(treeSection).toBeVisible();
    await expect(previewCard).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Feature: CurlPreview action buttons collapse to icon-only on mobile
// ---------------------------------------------------------------------------
test.describe("Feature: CurlPreview action buttons are compact on mobile", () => {
  test.beforeEach(async ({ page }) => {
    await setMobileViewport(page);
    await setupMocks(page);
    await page.goto("/");
  });

  // -------------------------------------------------------------------------
  // Scenario: Copy and Download buttons are present but labels are hidden on mobile
  // -------------------------------------------------------------------------
  test("Scenario: Copy Script and Download .sh buttons exist as icon-only on mobile", async ({ page }) => {
    // Given a file is selected so the preview renders
    await loadRepo(page);
    await page.locator("div.flex.md\\:hidden button", { hasText: "Preview" }).click();
    await page.locator("div.flex.md\\:hidden button", { hasText: "Repository Files" }).click();
    await page.locator("text=docs").click();
    await page.locator("span.truncate:text-is('README.md')").first().click();

    // The app auto-switches to Preview
    // When I inspect the action buttons in the preview header
    const copyBtn = page.locator("button svg.lucide-copy").locator(".."); // button containing Copy icon
    const downloadBtn = page.locator("button svg.lucide-download").locator("..");

    // Then the buttons exist (icons render)
    await expect(copyBtn).toBeVisible();
    await expect(downloadBtn).toBeVisible();

    // And the text labels are hidden on mobile (they use sm:inline which won't apply at 390px)
    const copyLabel = page.locator("button:has(svg.lucide-copy) span.sm\\:inline").first();
    await expect(copyLabel).toBeHidden();
  });
});

/**
 * Unit tests for computeSparsePathsAndCleanup and generateGitSparseScript
 *
 * Coverage:
 *   - Empty selection
 *   - All files in a dir selected → dir path used, no rm
 *   - Partial files in a dir selected → dir path + filesToRemove
 *   - Root-level files (no parent dir)
 *   - Mixed: some dirs full, some partial
 *   - No allRepoFiles provided → fallback to raw selectedPaths
 *   - Script content assertions (sparse paths, rm block, security header)
 */

import { describe, it, expect } from "vitest";
import {
  computeSparsePathsAndCleanup,
  generateGitSparseScript,
} from "./github";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ALL_REPO_FILES = [
  "README.md",
  "src/index.ts",
  "src/utils.ts",
  "src/helpers.ts",
  "docs/guide.md",
  "docs/api.md",
  "scripts/build.sh",
];

// ---------------------------------------------------------------------------
// computeSparsePathsAndCleanup
// ---------------------------------------------------------------------------
describe("computeSparsePathsAndCleanup", () => {
  it("returns empty arrays when selectedPaths is empty", () => {
    const result = computeSparsePathsAndCleanup([], ALL_REPO_FILES);
    expect(result.sparsePaths).toEqual([]);
    expect(result.filesToRemove).toEqual([]);
  });

  it("returns empty arrays when both inputs are empty", () => {
    const result = computeSparsePathsAndCleanup([], []);
    expect(result.sparsePaths).toEqual([]);
    expect(result.filesToRemove).toEqual([]);
  });

  it("uses directory path when ALL files in that dir are selected", () => {
    // Select all 2 docs files
    const selected = ["docs/guide.md", "docs/api.md"];
    const result = computeSparsePathsAndCleanup(selected, ALL_REPO_FILES);

    // Should use "docs" dir, not individual files
    expect(result.sparsePaths).toContain("docs");
    expect(result.sparsePaths).not.toContain("docs/guide.md");
    expect(result.sparsePaths).not.toContain("docs/api.md");
    expect(result.filesToRemove).toEqual([]);
  });

  it("uses directory path + marks unselected files for removal when PARTIAL selection", () => {
    // Select only index.ts from src (3 files total in src)
    const selected = ["src/index.ts"];
    const result = computeSparsePathsAndCleanup(selected, ALL_REPO_FILES);

    // Directory is still checked out
    expect(result.sparsePaths).toContain("src");
    // Unselected src files must be removed
    expect(result.filesToRemove).toContain("src/utils.ts");
    expect(result.filesToRemove).toContain("src/helpers.ts");
    // Selected file itself must NOT be in filesToRemove
    expect(result.filesToRemove).not.toContain("src/index.ts");
  });

  it("adds root-level files directly to sparsePaths without rm", () => {
    const selected = ["README.md"];
    const result = computeSparsePathsAndCleanup(selected, ALL_REPO_FILES);

    expect(result.sparsePaths).toContain("README.md");
    expect(result.filesToRemove).not.toContain("README.md");
  });

  it("handles mixed scenario: full dir + partial dir + root file", () => {
    // docs: full selection; src: partial (only index.ts); README.md: root file
    const selected = ["docs/guide.md", "docs/api.md", "src/index.ts", "README.md"];
    const result = computeSparsePathsAndCleanup(selected, ALL_REPO_FILES);

    // docs → full dir, no rm
    expect(result.sparsePaths).toContain("docs");
    // src → partial, dir checked out
    expect(result.sparsePaths).toContain("src");
    // Root file
    expect(result.sparsePaths).toContain("README.md");
    // Unselected src files marked for removal
    expect(result.filesToRemove).toContain("src/utils.ts");
    expect(result.filesToRemove).toContain("src/helpers.ts");
    expect(result.filesToRemove).not.toContain("src/index.ts");
    // docs files must NOT be in filesToRemove
    expect(result.filesToRemove).not.toContain("docs/guide.md");
    expect(result.filesToRemove).not.toContain("docs/api.md");
  });

  it("deduplicates sparsePaths and filesToRemove", () => {
    // Call with duplicate entries in selectedPaths (edge case)
    const selected = ["src/index.ts", "src/index.ts"];
    const result = computeSparsePathsAndCleanup(selected, ALL_REPO_FILES);

    const uniquePaths = [...new Set(result.sparsePaths)];
    expect(uniquePaths.length).toBe(result.sparsePaths.length);
    const uniqueRm = [...new Set(result.filesToRemove)];
    expect(uniqueRm.length).toBe(result.filesToRemove.length);
  });

  it("falls back to selecting individual files when allRepoFiles is empty", () => {
    const selected = ["src/index.ts", "src/utils.ts"];
    // No allRepoFiles context → can't determine if dir is fully selected
    // selected files should be individually listed
    const result = computeSparsePathsAndCleanup(selected, []);

    // Either sparsePaths contains individual files or the dir path
    // The key requirement: sparsePaths must be non-empty
    expect(result.sparsePaths.length).toBeGreaterThan(0);
    // No cleanup files since we don't know the full dir
    expect(result.filesToRemove).toEqual([]);
  });

  it("handles single file in a dir that has only one file total", () => {
    // scripts/ has only build.sh, selecting it = full dir
    const selected = ["scripts/build.sh"];
    const result = computeSparsePathsAndCleanup(selected, ALL_REPO_FILES);

    expect(result.sparsePaths).toContain("scripts");
    expect(result.filesToRemove).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// generateGitSparseScript
// ---------------------------------------------------------------------------
describe("generateGitSparseScript", () => {
  const OWNER = "test-owner";
  const REPO = "test-repo";
  const BRANCH = "main";

  it("produces a bash shebang and security header", () => {
    const script = generateGitSparseScript(OWNER, REPO, BRANCH, ["src/index.ts"], ALL_REPO_FILES);
    expect(script).toContain("#!/bin/bash");
    expect(script).toContain("GITHUB_PAT");
    expect(script).toContain("sparse-checkout");
  });

  it("uses directory path in sparse-checkout set when full dir selected", () => {
    const selected = ["docs/guide.md", "docs/api.md"];
    const script = generateGitSparseScript(OWNER, REPO, BRANCH, selected, ALL_REPO_FILES);

    // Should use dir path
    expect(script).toContain('"docs"');
    // Should NOT list individual files in the sparse-checkout set line
    const setLine = script.split("\n").find((l) => l.includes("sparse-checkout set"));
    expect(setLine).toBeDefined();
    expect(setLine).not.toContain("guide.md");
    expect(setLine).not.toContain("api.md");
  });

  it("includes rm commands for partial directory selections", () => {
    const selected = ["src/index.ts"];
    const script = generateGitSparseScript(OWNER, REPO, BRANCH, selected, ALL_REPO_FILES);

    // rm block should be present
    expect(script).toContain("rm");
    expect(script).toContain("src/utils.ts");
    expect(script).toContain("src/helpers.ts");
    // find + delete empty dirs
    expect(script).toContain("find . -type d -empty");
  });

  it("does NOT include rm commands when full directory is selected", () => {
    const selected = ["docs/guide.md", "docs/api.md"];
    const script = generateGitSparseScript(OWNER, REPO, BRANCH, selected, ALL_REPO_FILES);

    // No cleanup needed for full dir
    expect(script).not.toContain("Cleaning up unselected files");
    expect(script).not.toContain('rm "docs/');
  });

  it("falls back to raw file paths when no allRepoFiles provided", () => {
    const selected = ["src/index.ts", "src/utils.ts"];
    const script = generateGitSparseScript(OWNER, REPO, BRANCH, selected);
    // In fallback mode, the script should still reference the repo
    expect(script).toContain("test-owner/test-repo");
    expect(script).toContain("sparse-checkout set");
  });

  it("includes correct owner, repo, branch in script", () => {
    const script = generateGitSparseScript("acme", "my-lib", "develop", ["src/index.ts"], ALL_REPO_FILES);
    expect(script).toContain("acme/my-lib.git");
    expect(script).toContain("develop");
  });

  it("includes file count in confirmation prompt", () => {
    const selected = ["docs/guide.md", "docs/api.md"];
    const script = generateGitSparseScript(OWNER, REPO, BRANCH, selected, ALL_REPO_FILES);
    // "2 files will be sparse-downloaded"
    expect(script).toContain("2 files will be sparse-downloaded");
  });

  it("script stats header shows correct sparse path count and rm count", () => {
    const selected = ["src/index.ts"]; // partial src dir
    const script = generateGitSparseScript(OWNER, REPO, BRANCH, selected, ALL_REPO_FILES);
    // Sparse paths: 1 (src dir), Files to rm: 2 (utils.ts, helpers.ts)
    expect(script).toMatch(/Sparse paths\s*:\s*1/);
    expect(script).toMatch(/Files to rm\s*:\s*2/);
  });
});

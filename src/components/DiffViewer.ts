/**
 * DiffViewer - Diff display components
 *
 * - DiffViewer: Inline diff display for tool cards
 * - DiffModal: Full-screen modal for viewing complete diffs
 *
 * Uses CSS variables for theme compatibility.
 */

import { App, Modal } from "obsidian";
import type * as acp from "@agentclientprotocol/sdk";
import { createClickablePath } from "./PathFormatter";

interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
}

/**
 * Parse oldText and newText into structured diff lines
 */
function computeDiffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  let oldIdx = 0;
  let newIdx = 0;

  // Simple LCS-based diff algorithm
  const lcs = computeLCS(oldLines, newLines);

  let lcsIdx = 0;
  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && newIdx < newLines.length) {
      const [lcsOldIdx, lcsNewIdx] = lcs[lcsIdx];

      // Add removed lines before LCS match
      while (oldIdx < lcsOldIdx) {
        result.push({
          type: "remove",
          content: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
          newLineNum: null,
        });
        oldIdx++;
      }

      // Add new lines before LCS match
      while (newIdx < lcsNewIdx) {
        result.push({
          type: "add",
          content: newLines[newIdx],
          oldLineNum: null,
          newLineNum: newIdx + 1,
        });
        newIdx++;
      }

      // Add context line (LCS match)
      result.push({
        type: "context",
        content: oldLines[oldIdx],
        oldLineNum: oldIdx + 1,
        newLineNum: newIdx + 1,
      });
      oldIdx++;
      newIdx++;
      lcsIdx++;
    } else {
      // No more LCS matches - add remaining lines
      while (oldIdx < oldLines.length) {
        result.push({
          type: "remove",
          content: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
          newLineNum: null,
        });
        oldIdx++;
      }
      while (newIdx < newLines.length) {
        result.push({
          type: "add",
          content: newLines[newIdx],
          oldLineNum: null,
          newLineNum: newIdx + 1,
        });
        newIdx++;
      }
    }
  }

  return result;
}

/**
 * Compute LCS (Longest Common Subsequence) indices
 * Returns array of [oldIndex, newIndex] pairs
 */
function computeLCS(oldLines: string[], newLines: string[]): [number, number][] {
  const m = oldLines.length;
  const n = newLines.length;

  // DP table
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS indices
  const result: [number, number][] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      result.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Modal for viewing full diff
 */
export class DiffModal extends Modal {
  private diff: acp.Diff;

  constructor(app: App, diff: acp.Diff) {
    super(app);
    this.diff = diff;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("diff-modal");

    // Header
    const header = contentEl.createDiv({ cls: "diff-modal-header" });

    // Title with clickable path
    const titleContainer = header.createDiv({ cls: "diff-modal-title" });
    titleContainer.createSpan().setText("📄 ");
    if (this.diff.path) {
      createClickablePath(this.app, titleContainer, this.diff.path, { cls: "diff-modal-path" });
    } else {
      titleContainer.createSpan().setText("Unknown file");
    }

    // Actions
    const actions = header.createDiv({ cls: "diff-modal-actions" });

    // Copy diff button
    const copyBtn = actions.createEl("button", { cls: "diff-modal-btn" });
    copyBtn.setText("📋 Copy Diff");
    copyBtn.addEventListener("click", async () => {
      const diffText = this.generateDiffText();
      await navigator.clipboard.writeText(diffText);
      copyBtn.setText("✓ Copied!");
      setTimeout(() => copyBtn.setText("📋 Copy Diff"), 2000);
    });

    // Stats
    const oldText = this.diff.oldText ?? "";
    const newText = this.diff.newText ?? "";
    const diffLines = computeDiffLines(oldText, newText);
    const additions = diffLines.filter(l => l.type === "add").length;
    const deletions = diffLines.filter(l => l.type === "remove").length;

    const stats = header.createDiv({ cls: "diff-modal-stats" });
    if (additions > 0) {
      const addStat = stats.createSpan({ cls: "diff-stat-add" });
      addStat.setText(`+${additions}`);
    }
    if (deletions > 0) {
      const delStat = stats.createSpan({ cls: "diff-stat-remove" });
      delStat.setText(`-${deletions}`);
    }

    // Diff content
    const content = contentEl.createDiv({ cls: "diff-modal-content" });

    if (oldText || newText) {
      this.renderDiff(content, diffLines);
    } else {
      content.setText("No diff content available");
    }
  }

  private renderDiff(container: HTMLElement, diffLines: DiffLine[]): void {
    const table = container.createEl("table", { cls: "diff-table" });
    const tbody = table.createEl("tbody");

    for (const line of diffLines) {
      const tr = tbody.createEl("tr", { cls: `diff-row diff-row-${line.type}` });

      // Old line number
      const oldNumTd = tr.createEl("td", { cls: "diff-line-num diff-line-num-old" });
      if (line.oldLineNum !== null) {
        oldNumTd.setText(String(line.oldLineNum));
      }

      // New line number
      const newNumTd = tr.createEl("td", { cls: "diff-line-num diff-line-num-new" });
      if (line.newLineNum !== null) {
        newNumTd.setText(String(line.newLineNum));
      }

      // Prefix (+, -, space)
      const prefixTd = tr.createEl("td", { cls: "diff-line-prefix" });
      if (line.type === "add") {
        prefixTd.setText("+");
      } else if (line.type === "remove") {
        prefixTd.setText("-");
      } else {
        prefixTd.setText(" ");
      }

      // Content
      const contentTd = tr.createEl("td", { cls: "diff-line-content" });
      contentTd.createEl("pre").setText(line.content);
    }
  }

  private generateDiffText(): string {
    const oldText = this.diff.oldText ?? "";
    const newText = this.diff.newText ?? "";
    const diffLines = computeDiffLines(oldText, newText);

    const lines: string[] = [];
    lines.push(`--- ${this.diff.path ?? "a/file"}`);
    lines.push(`+++ ${this.diff.path ?? "b/file"}`);

    for (const line of diffLines) {
      if (line.type === "add") {
        lines.push("+" + line.content);
      } else if (line.type === "remove") {
        lines.push("-" + line.content);
      } else {
        lines.push(" " + line.content);
      }
    }

    return lines.join("\n");
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Inline diff viewer for tool cards (compact version)
 */
export class DiffViewer {
  private container: HTMLElement;

  constructor(parent: HTMLElement, diff: acp.Diff) {
    this.container = parent.createDiv({ cls: "diff-viewer" });

    // File header
    const header = this.container.createDiv({ cls: "diff-viewer-header" });
    header.setText(`📄 ${diff.path ?? "Unknown file"}`);

    // Diff content
    const content = this.container.createDiv({ cls: "diff-viewer-content" });

    // Generate diff from oldText and newText
    const oldText = diff.oldText ?? "";
    const newText = diff.newText ?? "";

    if (oldText || newText) {
      this.renderSimpleDiff(content, oldText, newText);
    } else {
      content.setText("No diff content available");
    }
  }

  private renderSimpleDiff(container: HTMLElement, oldText: string, newText: string): void {
    const diffLines = computeDiffLines(oldText, newText);
    const linesContainer = container.createDiv({ cls: "diff-viewer-lines" });

    // Show only first 10 lines for compact view
    const maxLines = Math.min(diffLines.length, 10);

    for (let i = 0; i < maxLines; i++) {
      const line = diffLines[i];
      const lineEl = linesContainer.createDiv({ cls: `diff-viewer-line diff-line-${line.type}` });

      const prefix = line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  ";
      const contentSpan = lineEl.createSpan({ cls: "diff-line-content" });
      contentSpan.setText(prefix + line.content);
    }

    if (diffLines.length > 10) {
      const moreEl = linesContainer.createDiv({ cls: "diff-viewer-line diff-line-context" });
      moreEl.setText(`  ... (${diffLines.length - 10} more lines)`);
    }
  }

  getElement(): HTMLElement {
    return this.container;
  }
}

/**
 * Creates a simple inline diff from old and new text
 * Used when we don't have structured diff data
 */
export function createSimpleDiff(oldText: string, newText: string): HTMLElement {
  const container = document.createElement("div");
  container.className = "simple-diff";

  const diffLines = computeDiffLines(oldText, newText);

  for (const line of diffLines) {
    const lineEl = document.createElement("div");
    lineEl.className = `diff-line diff-line-${line.type}`;

    const prefix = line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  ";
    lineEl.textContent = prefix + line.content;
    container.appendChild(lineEl);
  }

  return container;
}

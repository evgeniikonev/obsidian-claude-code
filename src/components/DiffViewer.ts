/**
 * DiffViewer - Simple diff display component
 *
 * Renders diff from oldText/newText with Obsidian-compatible styling.
 * Uses CSS variables for theme compatibility.
 */

import type * as acp from "@agentclientprotocol/sdk";

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
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");

    const linesContainer = container.createDiv({ cls: "diff-viewer-lines" });

    // Simple line-by-line diff
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === newLine) {
        // Unchanged
        if (oldLine !== undefined) {
          const lineEl = linesContainer.createDiv({ cls: "diff-viewer-line diff-line-context" });
          const content = lineEl.createSpan({ cls: "diff-line-content" });
          content.setText("  " + oldLine);
        }
      } else {
        // Changed - show both
        if (oldLine !== undefined) {
          const oldEl = linesContainer.createDiv({ cls: "diff-viewer-line diff-line-remove" });
          const content = oldEl.createSpan({ cls: "diff-line-content" });
          content.setText("- " + oldLine);
        }
        if (newLine !== undefined) {
          const newEl = linesContainer.createDiv({ cls: "diff-viewer-line diff-line-add" });
          const content = newEl.createSpan({ cls: "diff-line-content" });
          content.setText("+ " + newLine);
        }
      }
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

  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Very simple line-by-line comparison
  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      // Unchanged
      const lineEl = document.createElement("div");
      lineEl.className = "diff-line diff-line-context";
      lineEl.textContent = "  " + (oldLine ?? "");
      container.appendChild(lineEl);
    } else {
      // Changed - show both
      if (oldLine !== undefined) {
        const oldEl = document.createElement("div");
        oldEl.className = "diff-line diff-line-remove";
        oldEl.textContent = "- " + oldLine;
        container.appendChild(oldEl);
      }
      if (newLine !== undefined) {
        const newEl = document.createElement("div");
        newEl.className = "diff-line diff-line-add";
        newEl.textContent = "+ " + newLine;
        container.appendChild(newEl);
      }
    }
  }

  return container;
}

/**
 * UI Components for Claude Code Plugin
 *
 * Phase 4.1 Components:
 * - ThinkingBlock: Collapsible agent reasoning display
 * - ToolCallCard: Tool execution status and results
 * - DiffViewer: File diff visualization
 * - PermissionModal: Promise-based permission dialogs
 */

export { ThinkingBlock } from "./ThinkingBlock";
export { ToolCallCard } from "./ToolCallCard";
export { DiffViewer, createSimpleDiff } from "./DiffViewer";
export { PermissionModal, showQuickPermission } from "./PermissionModal";

import { ItemView, WorkspaceLeaf, MarkdownRenderer, setIcon } from "obsidian";
import type ClaudeCodePlugin from "../main";
import type * as acp from "@agentclientprotocol/sdk";
import { ThinkingBlock, ToolCallCard } from "../components";

export const CHAT_VIEW_TYPE = "claude-code-chat";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export class ChatView extends ItemView {
  private plugin: ClaudeCodePlugin;
  private messagesContainer: HTMLElement;
  private inputContainer: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private sendButton: HTMLButtonElement;
  private statusIndicator: HTMLElement;
  private messages: Message[] = [];

  // Streaming state
  private currentAssistantMessage: string = "";
  private currentStreamingEl: HTMLElement | null = null;

  // Thinking state
  private currentThinkingBlock: ThinkingBlock | null = null;

  // Tool calls state (track by ID for updates)
  private toolCallCards: Map<string, ToolCallCard> = new Map();

  // Batch update for streaming performance
  private pendingText: string = "";
  private updateScheduled: boolean = false;

  constructor(leaf: WorkspaceLeaf, plugin: ClaudeCodePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return CHAT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Claude Code";
  }

  getIcon(): string {
    return "bot";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("claude-code-chat");

    // Header with status
    const header = container.createDiv({ cls: "chat-header" });
    const title = header.createDiv({ cls: "chat-title" });
    title.setText("Claude Code");

    this.statusIndicator = header.createDiv({ cls: "chat-status" });
    this.updateStatus("disconnected");

    // Connect button
    const connectBtn = header.createEl("button", { cls: "chat-connect-btn" });
    setIcon(connectBtn, "plug");
    connectBtn.addEventListener("click", () => this.handleConnect());

    // Messages container
    this.messagesContainer = container.createDiv({ cls: "chat-messages" });

    // Input container
    this.inputContainer = container.createDiv({ cls: "chat-input-container" });

    this.textarea = this.inputContainer.createEl("textarea", {
      cls: "chat-input",
      attr: { placeholder: "Ask Claude Code..." },
    });

    this.textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Auto-resize textarea
    this.textarea.addEventListener("input", () => {
      this.textarea.style.height = "auto";
      this.textarea.style.height = Math.min(this.textarea.scrollHeight, 200) + "px";
    });

    this.sendButton = this.inputContainer.createEl("button", { cls: "chat-send-btn" });
    setIcon(this.sendButton, "send");
    this.sendButton.addEventListener("click", () => this.handleSend());

    // Welcome message
    this.addMessage({
      role: "assistant",
      content: "Welcome! Click the plug icon to connect to Claude Code, then start chatting.",
      timestamp: new Date(),
    });
  }

  async onClose(): Promise<void> {
    // Cleanup
    this.toolCallCards.clear();
    this.currentThinkingBlock = null;
    this.currentStreamingEl = null;
  }

  private async handleConnect(): Promise<void> {
    if (this.plugin.isConnected()) {
      await this.plugin.disconnect();
    } else {
      await this.plugin.connect();
    }
  }

  private async handleSend(): Promise<void> {
    const text = this.textarea.value.trim();
    if (!text) return;

    if (!this.plugin.isConnected()) {
      this.addMessage({
        role: "assistant",
        content: "⚠️ Not connected. Click the plug icon to connect first.",
        timestamp: new Date(),
      });
      return;
    }

    // Add user message
    this.addMessage({
      role: "user",
      content: text,
      timestamp: new Date(),
    });

    // Clear input
    this.textarea.value = "";
    this.textarea.style.height = "auto";

    // Reset streaming state
    this.resetStreamingState();
    this.updateStatus("thinking");

    try {
      await this.plugin.sendMessage(text);
    } catch (error) {
      this.addMessage({
        role: "assistant",
        content: `❌ Error: ${(error as Error).message}`,
        timestamp: new Date(),
      });
      this.updateStatus("connected");
    }
  }

  private resetStreamingState(): void {
    this.currentAssistantMessage = "";
    this.currentStreamingEl = null;
    this.currentThinkingBlock = null;
    this.toolCallCards.clear();
    this.pendingText = "";
    this.updateScheduled = false;
  }

  // ===== Session Update Handlers =====

  /**
   * Handle agent thought chunk (internal reasoning)
   */
  onThoughtChunk(content: acp.ContentBlock): void {
    if (content.type !== "text") return;

    // Create thinking block if not exists
    if (!this.currentThinkingBlock) {
      this.currentThinkingBlock = new ThinkingBlock(this.messagesContainer);
    }

    this.currentThinkingBlock.appendText(content.text ?? "");
    this.scrollToBottom();
  }

  /**
   * Handle agent message chunk (final response)
   */
  onMessageChunk(content: acp.ContentBlock): void {
    if (content.type !== "text") return;

    // Finalize thinking block if exists
    if (this.currentThinkingBlock) {
      this.currentThinkingBlock.complete();
      this.currentThinkingBlock = null;
    }

    // Batch text updates for performance
    this.pendingText += content.text ?? "";

    if (!this.updateScheduled) {
      this.updateScheduled = true;
      requestAnimationFrame(() => {
        this.currentAssistantMessage += this.pendingText;
        this.pendingText = "";
        this.updateScheduled = false;
        this.updateStreamingMessage();
      });
    }
  }

  /**
   * Handle new tool call
   */
  onToolCall(toolCall: acp.ToolCall & { sessionUpdate: "tool_call" }): void {
    const toolCallId = toolCall.toolCallId ?? `tool-${Date.now()}`;

    // Create tool card
    const card = new ToolCallCard(this.messagesContainer, toolCall, {
      onViewDiff: (diff) => this.showDiffModal(diff),
    });

    this.toolCallCards.set(toolCallId, card);
    this.scrollToBottom();
  }

  /**
   * Handle tool call update
   */
  onToolCallUpdate(update: acp.ToolCallUpdate & { sessionUpdate: "tool_call_update" }): void {
    const toolCallId = update.toolCallId ?? "";
    const card = this.toolCallCards.get(toolCallId);

    if (card) {
      card.update(update);
    } else {
      console.warn(`[ChatView] Tool call not found: ${toolCallId}`);
    }

    this.scrollToBottom();
  }

  /**
   * Handle plan update
   */
  onPlan(plan: acp.Plan & { sessionUpdate: "plan" }): void {
    // Create or update plan display
    let planEl = this.messagesContainer.querySelector(".plan-view") as HTMLElement;

    if (!planEl) {
      planEl = this.messagesContainer.createDiv({ cls: "plan-view" });
    }

    planEl.empty();

    const header = planEl.createDiv({ cls: "plan-header" });
    header.setText("📋 Plan");

    const entries = planEl.createDiv({ cls: "plan-entries" });

    for (const entry of plan.entries) {
      const entryEl = entries.createDiv({ cls: `plan-entry plan-entry-${entry.status}` });

      // Status icon based on PlanEntryStatus: "pending" | "in_progress" | "completed"
      const statusIcon = entry.status === "completed" ? "✅" :
                        entry.status === "in_progress" ? "🔄" : "⏳";

      const iconEl = entryEl.createSpan({ cls: "plan-entry-icon" });
      iconEl.setText(statusIcon);

      const titleEl = entryEl.createSpan({ cls: "plan-entry-title" });
      titleEl.setText(entry.content);
    }

    this.scrollToBottom();
  }

  // ===== Legacy Methods (for backward compatibility) =====

  /**
   * @deprecated Use onMessageChunk instead
   */
  appendAssistantMessage(text: string): void {
    this.currentAssistantMessage += text;
    this.updateStreamingMessage();
  }

  /**
   * Called when assistant response is complete
   */
  completeAssistantMessage(): void {
    // Finalize thinking block if exists
    if (this.currentThinkingBlock) {
      this.currentThinkingBlock.complete();
      this.currentThinkingBlock = null;
    }

    // Finalize streaming message
    if (this.currentAssistantMessage) {
      // Remove streaming class
      if (this.currentStreamingEl) {
        this.currentStreamingEl.removeClass("message-streaming");
      }

      this.messages.push({
        role: "assistant",
        content: this.currentAssistantMessage,
        timestamp: new Date(),
      });

      this.currentAssistantMessage = "";
      this.currentStreamingEl = null;
    }

    this.updateStatus("connected");
  }

  // ===== Private Methods =====

  private updateStreamingMessage(): void {
    // Find or create streaming message element
    if (!this.currentStreamingEl) {
      this.currentStreamingEl = this.messagesContainer.createDiv({
        cls: "message message-assistant message-streaming",
      });
    }

    // Render markdown content
    this.currentStreamingEl.empty();
    MarkdownRenderer.render(
      this.app,
      this.currentAssistantMessage,
      this.currentStreamingEl,
      "",
      this
    );

    this.scrollToBottom();
  }

  private addMessage(message: Message): void {
    this.messages.push(message);

    const messageEl = this.messagesContainer.createDiv({
      cls: `message message-${message.role}`,
    });

    // Render content with markdown
    MarkdownRenderer.render(
      this.app,
      message.content,
      messageEl,
      "",
      this
    );

    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private showDiffModal(diff: acp.Diff): void {
    // For now, just log. Full modal will be added later.
    console.log("[ChatView] Show diff modal:", diff.path);
    // TODO: Implement DiffModal
  }

  updateStatus(status: "disconnected" | "connecting" | "connected" | "thinking"): void {
    this.statusIndicator.empty();
    this.statusIndicator.removeClass("status-disconnected", "status-connecting", "status-connected", "status-thinking");
    this.statusIndicator.addClass(`status-${status}`);

    const statusText: Record<string, string> = {
      disconnected: "Disconnected",
      connecting: "Connecting...",
      connected: "Connected",
      thinking: "Thinking...",
    };

    this.statusIndicator.setText(statusText[status]);
  }
}

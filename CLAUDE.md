# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

**obsidian-claude-code-plugin** — Obsidian плагин, реализующий ACP-клиент для интеграции с Claude Code.

Плагин позволяет использовать полноценный Claude Code агент прямо в Obsidian, аналогично интеграции в Zed или Cursor. Это не просто чат с API — это agentic workflow с tool calls, permission requests, edit review и доступом к файлам vault.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Obsidian                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │           obsidian-claude-code-plugin             │  │
│  │                  (ACP Client)                     │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │  │
│  │  │  Chat View  │  │ Diff Viewer │  │ Terminal  │  │  │
│  │  └─────────────┘  └─────────────┘  └───────────┘  │  │
│  │           │                                       │  │
│  │  ┌────────▼────────────────────────────────────┐  │  │
│  │  │         ClientSideConnection                │  │  │
│  │  │    (@agentclientprotocol/sdk)               │  │  │
│  │  └────────┬────────────────────────────────────┘  │  │
│  └───────────│───────────────────────────────────────┘  │
└──────────────│──────────────────────────────────────────┘
               │ JSON-RPC over stdio
               ▼
┌──────────────────────────────────────────────────────────┐
│                   claude-code-acp                        │
│              (ACP Server / Claude Agent)                 │
│         @zed-industries/claude-code-acp                  │
└──────────────────────────────────────────────────────────┘
```

## Key Technologies

- **ACP (Agent Client Protocol)** — протокол коммуникации между редакторами и AI-агентами
- **claude-code-acp** — ACP-сервер, оборачивающий Claude Code SDK
- **@agentclientprotocol/sdk** — TypeScript SDK для создания ACP-клиентов
- **Obsidian Plugin API** — API для создания плагинов Obsidian

## Development Commands

```bash
# Install dependencies
npm install

# Build plugin
npm run build

# Development mode with watch
npm run dev

# Type check
npm run typecheck

# Headless ACP test (no Obsidian needed)
npm run test:headless
```

## Plugin Structure

```
src/
├── main.ts              # Plugin entry point, commands, ribbon icon
├── acpClient.ts         # ACP connection: spawn, ClientSideConnection, events
└── views/
    └── ChatView.ts      # Chat interface (ItemView)

tests/
└── headless-test.ts     # Standalone ACP connection test

styles.css               # Chat UI styles
manifest.json            # Obsidian plugin manifest
```

## Testing in Obsidian

1. Build plugin: `npm run build`
2. Copy `main.js`, `manifest.json`, `styles.css` to vault's `.obsidian/plugins/obsidian-claude-code/`
3. Enable plugin in Obsidian settings
4. Ensure `claude-code-acp` is installed globally: `npm install -g @zed-industries/claude-code-acp`

## Key Concepts

### ACP Transport
Плагин спавнит `claude-code-acp` как child process и общается через JSON-RPC over stdio.

### Vault Integration
Файлы vault маппятся на ACP file system protocol. @-mentions позволяют добавлять заметки в контекст.

### Permission Model
Tool calls требуют подтверждения пользователя через UI (edit review, command execution).

## Development Workflow

### Making Changes

1. **Implement feature/fix** - write code
2. **Build**: `npm run build`
3. **Typecheck**: `npm run typecheck`
4. **Ask user to test** - wait for user approval before release
5. Only proceed to release after user confirms it works

### Release Process

**IMPORTANT**: Always use `npm run version` script, never edit version manually!

```bash
# 1. Bump version (choose one):
npm run version patch   # 0.8.0 -> 0.8.1 (bug fixes)
npm run version minor   # 0.8.0 -> 0.9.0 (new features)
npm run version major   # 0.8.0 -> 1.0.0 (breaking changes)

# 2. Build with new version:
npm run build

# 3. Commit changes:
git add -A
git commit -m "v0.9.0: Short description of changes"

# 4. Tag and push:
git tag v0.9.0
git push origin main --tags
```

GitHub Actions will automatically create the release with `main.js`, `manifest.json`, `styles.css`.

### Commit Message Format

```
vX.Y.Z: Short description

- Detail 1
- Detail 2
```

**IMPORTANT**: Do NOT add `Co-Authored-By` line to commits in this project!

### Version Semantics

- **patch** (0.0.X): Bug fixes, small improvements
- **minor** (0.X.0): New features, backwards compatible
- **major** (X.0.0): Breaking changes

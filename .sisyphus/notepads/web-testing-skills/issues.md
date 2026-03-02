# Issues

## Notes
- Append-only. Record blockers, errors, and environment gotchas.

## 2026-03-01
- Environment: `bun` not installed; `node`/`npm`/`npx` available.
- Workspace: not a git repository (`git rev-parse --is-inside-work-tree` fails) so commit steps in plan cannot run unless repo is initialized.
- LSP: TypeScript LSP server not installed (`typescript-language-server` missing), so `lsp_diagnostics` cannot run on `.ts` files; use `npx playwright test --list` / test execution as verification instead.
## 2026-03-02T00:37:02+08:00 - Playwright Installation

**Status:** SUCCESS

**Environment:**
- Platform: Windows (win32)
- Node.js: v20.20.0
- npm: 10.8.2
- Playwright version: 1.58.2

**Installation steps completed:**
1. Created package.json with `npm init -y`
2. Installed `@playwright/test` as dev dependency via `npm install -D @playwright/test`
3. Verified `npx playwright --version` returns Version 1.58.2
4. Installed Chromium browser via `npx playwright install chromium`

**Issues encountered:** None - installation completed smoothly.

**Notes:**
- Repository is NOT a git repo (git commands will fail)
- bun is NOT available in this environment
- Installation at repo root (D:\Code\Ai\bigRedBut)
## 2026-03-02T01:55 - Web Developer Modules Verification

### Issues Encountered: None

All three modules (verify-fixes.ts, update-knowledge.ts, fix-log.ts) were created and verified without errors.

### Notes

- Modules use only Node.js stdlib (fs/promises, path, child_process)
- Path normalization ensures Windows compatibility
- Append-only pattern prevents data loss
- Playwright integration uses JSON reporter for structured output
- TDD loop logging provides detailed statistics for debugging


## 2026-03-02 - Session Interrupt Smoke
- No functional blocker in two-phase interrupt/resume flow.
- Minor tooling gotcha: shell quoting can misinterpret backticks in long inline command notes; use plain-text command strings when appending notepads.

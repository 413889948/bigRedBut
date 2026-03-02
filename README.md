# Web Testing + Fix Loop Template

Language Index:
- English: `README.md`
- Chinese: `README.zh-CN.md`

This project is a local template for two agent skills:
- `web-tester`: test-only / test-and-fix testing workflow
- `web-developer`: TDD-oriented fix and verification loop

It includes Playwright test execution, checkpoint persistence, and OpenSpec change artifact scaffolding.

## 1) Language and Selection Logic

### Why TypeScript + Node.js
- TypeScript gives stable data contracts for checkpoints, test reports, and TDD loop logs.
- Node.js has first-class file/process APIs needed for this workflow: `fs`, `path`, `child_process`.
- Playwright ecosystem is mature on Node, so browser testing and report generation are straightforward.

### Why this toolchain
- `@playwright/test`: E2E test execution and JSON report output.
- `tsx` (invoked via `npx -y tsx`): run TS modules/scripts directly for orchestration and verification.
- `openspec-cn`: manage change artifacts and workflow schema.

## 2) Core Logic (How it is selected and used)

The project uses a layered execution model:

1. **Test Execution Layer**
   - `src/web-tester/execute-tests.ts` runs `npx playwright test --workers=1`.
   - Optional JSON output file is used for machine parsing.

2. **Failure Parsing + TDD Loop Layer**
   - `src/web-developer/parse-report.ts` parses Playwright JSON into failure cases.
   - `src/web-developer/tdd-loop.ts` controls `write-test -> apply-fix -> verify` with attempt limits.
   - `src/web-developer/fix-engine.ts` provides deterministic, safe fix strategies.

3. **Persistence Layer (interrupt/resume)**
   - `src/checkpoint.ts`, `src/checkpoint-validator.ts`, `src/session-manager.ts` persist session state.
   - Checkpoint path: `projects/<projectName>/sessions/checkpoints/<sessionId>.json`.

4. **Knowledge + Audit Layer**
   - `src/web-developer/fix-log.ts` appends fix logs.
   - `src/web-developer/update-knowledge.ts` appends gotchas/test-guide notes.

5. **OpenSpec Artifact Layer**
   - `src/openspec/sync.ts` ensures change artifacts exist from templates.
   - Schema: `openspec/schemas/web-test-session/`.

This separation is deliberate:
- execution modules stay small and composable,
- state can be resumed safely,
- logs and artifacts are append-friendly for audits.

## 3) Repository Structure

- `.opencode/skills/web-tester/SKILL.md`
- `.opencode/skills/web-developer/SKILL.md`
- `playwright.config.ts`
- `tests/e2e/`
- `src/web-tester/`
- `src/web-developer/`
- `src/openspec/sync.ts`
- `projects/template/knowledge/`
- `projects/template/sessions/`
- `openspec/config.yaml`
- `openspec/schemas/web-test-session/`

## 4) Quick Start

### Prerequisites
- Node.js 20+
- npm / npx
- `openspec-cn` CLI installed

### Install
```bash
npm install
npx playwright install chromium
```

### Basic checks
```bash
npx playwright --version
npx playwright test --list
npx playwright test tests/e2e/example.spec.ts --reporter=list
```

### Optional env
Create `.env` from `.env.example` and set:
- `PLAYWRIGHT_TEST_BASE_URL`
- `PLAYWRIGHT_BROWSERS_PATH=0`

## 5) Typical Usage Flows

### A. test-only
1. Create OpenSpec change:
   - `openspec-cn new change test-only-smoke --schema web-test-session`
2. Sync artifacts (`src/openspec/sync.ts`).
3. Run tests and save JSON report.
4. Save checkpoint.

### B. test-and-fix
1. Run tests -> parse failures.
2. Run TDD loop (`runTddLoop` + `applyFixForFailure` + verify callback).
3. Append fix log and knowledge notes.
4. Save checkpoint and check OpenSpec status.

### C. interrupt-resume
1. Save partial checkpoint in Phase A.
2. Resume from checkpoint in Phase B.
3. Continue loop until verification passes.

## 6) Skill Usage Guide

### `web-tester` skill
Purpose:
- Discover pages/features and execute test-only or pre-fix validation runs.

Typical responsibilities:
- Collect test scope (full run or specific feature path).
- Execute Playwright tests and generate machine-readable reports.
- Save checkpoint for resumability.

Key files:
- `.opencode/skills/web-tester/SKILL.md`
- `src/web-tester/execute-tests.ts`
- `src/web-tester/discover.ts`
- `src/web-tester/generate-tests.ts`

### `web-developer` skill
Purpose:
- Parse failures, run TDD fix loop, verify, and persist logs/knowledge.

Typical responsibilities:
- Parse JSON report into failure cases.
- Apply safe fixes per failure with bounded attempts.
- Re-run verification and persist fix/knowledge outputs.

Key files:
- `.opencode/skills/web-developer/SKILL.md`
- `src/web-developer/parse-report.ts`
- `src/web-developer/tdd-loop.ts`
- `src/web-developer/fix-engine.ts`
- `src/web-developer/fix-log.ts`
- `src/web-developer/update-knowledge.ts`

## 7) Usage Examples

### Example A: run test-only with JSON output
```bash
npx -y tsx -e "import { executeTests } from './src/web-tester/execute-tests'; (async () => { const r = await executeTests({ testFiles: ['tests/e2e/example.spec.ts'], reporterJsonPath: 'test-results/example.json' }); console.log(JSON.stringify({ ok: r.ok, exitCode: r.exitCode }, null, 2)); })();"
```

### Example B: create OpenSpec change and scaffold artifacts
```bash
openspec-cn new change my-session --schema web-test-session
npx -y tsx -e "import { syncOpenSpecChangeArtifacts } from './src/openspec/sync'; const r = syncOpenSpecChangeArtifacts({ changeName: 'my-session', projectName: 'template', sessionId: 'my-session' }); console.log(JSON.stringify(r, null, 2));"
openspec-cn status --change my-session
```

### Example C: save and resume checkpoint
```bash
npx -y tsx -e "import { saveCheckpoint, loadCheckpoint } from './src/checkpoint'; (async () => { await saveCheckpoint('template', 'demo-session', { version: '1.0.0', sessionId: 'demo-session', mode: 'test-only', lastUpdated: new Date().toISOString(), tester: { completedTasks: [] }, developer: { completedFixes: [] }, knowledge: { techStack: [], gotchas: [], testNotes: [] } }); const cp = await loadCheckpoint('template', 'demo-session'); console.log(cp ? 'loaded' : 'missing'); })();"
```

## 8) Configuration Files

- `playwright.config.ts`
  - Core Playwright settings: `testDir`, `workers`, `retries`, `timeout`, `outputDir`, `baseURL`, `projects`.
  - `baseURL` defaults to `about:blank` if `PLAYWRIGHT_TEST_BASE_URL` is not set.

- `.env.example`
  - Environment variable template.
  - Includes `PLAYWRIGHT_BROWSERS_PATH=0` and project-level runtime variables.

- `openspec/config.yaml`
  - Selects active schema (`web-test-session`) used by `openspec-cn`.

- `openspec/schemas/web-test-session/schema.yaml`
  - Defines required artifacts for a change (`test-report`, `fix-log`, `tasks`).

- `package.json`
  - Dependency declaration (`@playwright/test`).
  - Note: this repo currently does not rely on npm scripts for orchestration.

## 9) Notes and Constraints

- This template is for controlled test environments, not production by default.
- No auto-commit behavior is implemented.
- Current `package.json` has no build script; execution is driven by direct `npx` commands.

## 10) Key File References

- `src/web-tester/execute-tests.ts`
- `src/web-developer/parse-report.ts`
- `src/web-developer/tdd-loop.ts`
- `src/web-developer/fix-engine.ts`
- `src/web-developer/verify-fixes.ts`
- `src/web-developer/fix-log.ts`
- `src/web-developer/update-knowledge.ts`
- `src/checkpoint.ts`
- `src/checkpoint-validator.ts`
- `src/session-manager.ts`
- `src/openspec/sync.ts`

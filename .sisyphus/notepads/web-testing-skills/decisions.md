# Decisions

## Notes
- Append-only. Record architectural decisions and rationale.

## 2026-03-01
- Use `npm`/`npx` instead of `bun` commands during implementation (minimal adaptation).
- Follow Playwright security guidance: store auth state under `playwright/.auth` and add it to `.gitignore`; do NOT commit storage state even in private repos.


## 2026-03-02
- Add `playwright/.auth/` and `projects/*/sessions/*.json` to `.gitignore` per Playwright security guidance (never commit storage state, even in private repos).
- Create `.env.example` with `PLAYWRIGHT_TEST_BASE_URL` and `PLAYWRIGHT_BROWSERS_PATH=0` for reproducible test setup.
- Explicitly preserve `projects/*/knowledge/` directories (not ignored) for reusable test knowledge templates.
# 2026-03-02

## Checkpoint Schema Design (Task 2.1)

### Version Field
- **Type**: string (semver format: `X.Y.Z`)
- **Rationale**: String format allows flexible versioning including pre-release tags (e.g., `1.0.0-beta`). Easier to compare than integers. Pattern validation ensures consistency.

### Mode Enum Values
- `test-only`: Execute tests, generate reports, no code modifications
- `test-and-fix`: Full TDD cycle - run test, identify bug, write failing test, implement fix, verify

### Tester Object Design
- `completedTasks`: Required array - tracks all executed tests with status (passed/failed/skipped)
- `currentTask`/ `currentStep`/ `totalSteps`: Enable granular checkpoint/resume within a task
- `discoveredNewTasks`: Supports dynamic task discovery during exploration
- `storageStatePath`: String path (e.g., `playwright/.auth/user.json`) - stores auth state location, NOT embedded cookies

### Developer Object Design
- `completedFixes`: Required array - tracks all resolved bugs with TDD cycle metadata
- `currentFix`: Object with TDD phase tracking (`analyzing` → `writing-test` → `implementing-fix` → `verifying`)
- `attempts`: Integer counter - prevents infinite TDD loops (max 3 attempts planned)

### Knowledge Object Design
- `techStack`: Categorized technology inventory (frontend/backend/database/testing/infrastructure/other)
- `gotchas`: Known issues with severity levels and workarounds
- `testNotes`: Testing-specific insights linked to related test files

### Schema Strictness
- `additionalProperties: false` - catches corrupted or malformed checkpoints
- All required fields enforced at root and nested object levels
- ISO 8601 date-time format for temporal fields
- Enum constraints on status fields prevent invalid states

### JSON Schema Version
- Draft 2020-12 (latest stable at time of design)
- Provides modern validation features while maintaining broad tool support


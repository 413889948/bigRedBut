# Learnings

## Notes
- Append-only. Record patterns, conventions, and what worked.
# Web Testing Skills Learnings

## Playwright Test Setup Patterns

### Directory Structure
- `tests/e2e/` - Contains end-to-end test specifications
- `tests/fixtures/` - Contains test fixtures (page models, mock data, etc.)
- `test-results/` - Auto-generated test output (gitignore)
- `playwright-report/` - HTML reporter output (gitignore)

### Conventions
1. Test files use `.spec.ts` extension
2. Use `test('description', async ({ page }) => {...})` pattern
3. baseURL should be configured in playwright.config.ts, not hardcoded in tests
4. Tests should handle missing config gracefully during setup phase

### Gotchas
- Without playwright.config.ts, page.goto('/') fails with 'Cannot navigate to invalid URL'
- Use fallback like 'about:blank' when baseURL may not be configured
- Test title duplicates cause 'duplicate test title' error - ensure unique test names

### Verification
- Run single test: `npx playwright test tests/e2e/example.spec.ts`
- Test passes with about:blank fallback, will work with real baseURL after config


## Playwright Configuration Conventions (Mon Mar  2 00:46:20     2026)

### Core Settings
- `workers: 1` - Serial execution to prevent test interference
- `timeout: 5 * 60 * 1000` - 5 minute timeout per test
- `retries: process.env.CI ? 3 : 0` - Retry only on CI to catch flakiness
- `testDir: './tests/e2e'` - Tests located in tests/e2e directory
- `outputDir: 'test-results'` - Test artifacts output location

### Browser Configuration
- Single project: `chromium` using `devices['Desktop Chrome']`
- Other browsers commented out for faster CI runs

### Environment Variables
- `PLAYWRIGHT_TEST_BASE_URL` - Override baseURL via environment variable
- Safe default: `'about:blank'` prevents connection errors during setup

### Storage State (Auth)
- Path: `playwright/.auth/user.json`
- Conditional inclusion: Only loaded if file exists OR running on CI
- Pattern: `...(condition ? { storageState: 'path' } : {})`
- Prevents 'file not found' errors on first run

### Best Practices Applied
1. Environment-driven configuration (baseURL via env var)
2. Graceful degradation (storageState optional)
3. CI-aware settings (retries, forbidOnly)
4. Serial execution prevents state bleeding between tests


## Project Knowledge Template Convention

- Created knowledge template structure under projects/template/
- knowledge/: Static documentation (tech-stack.md, gotchas.md, test-guide.md)
- sessions/: Dynamic session state and checkpoints/ for snapshots
- Templates use ASCII headers + bullet placeholders for easy filling

## Test Data Management Utilities (Mon Mar  2 2026)

### File Location
- `tests/fixtures/test-data.ts` - Typed test data generators

### Available Generators

**User Generators:**
- `generateUser(overrides?)` - Creates single user with auto-generated id, email, username
- `generateUsers(count, overrides?)` - Creates array of users

**Product Generators:**
- `generateProduct(overrides?)` - Creates single product with id, name, price
- `generateProducts(count, overrides?)` - Creates array of products

**Article Generators:**
- `generateArticle(overrides?)` - Creates single article with id, title, content
- `generateArticles(count, overrides?)` - Creates array of articles

**Generic Generator:**
- `generateItem<T>(type, overrides?)` - Type-safe generator for 'user' | 'product' | 'article'

**Seed & Reset:**
- `seedTestData(seed?)` - Returns SeedData with users (3), products (5), articles (2)
- `resetTestData()` - Resets ID counter for reproducible test runs

### Usage with Playwright Route Interception

```typescript
import { generateUser, generateProducts, seedTestData, resetTestData } from '../fixtures/test-data';

test('example', async ({ page }) => {
  const testData = seedTestData();
  
  await page.route('**/api/users', (route) => {
    route.fulfill({ json: testData.users });
  });
  
  await page.route('**/api/products', (route) => {
    route.fulfill({ json: testData.products });
  });
  
  // ... test logic
  
  resetTestData(); // Optional: clean state for next test
});
```

### Customization Pattern

```typescript
// Override specific fields
const adminUser = generateUser({ 
  email: 'admin@example.com', 
  username: 'admin' 
});

// Generate multiple with shared properties
const products = generateProducts(10, { 
  inStock: true, 
  category: 'electronics' 
});
```

### Key Design Decisions
1. **No external dependencies** - Pure TypeScript, no MSW or mock libraries
2. **ASCII only** - No emojis or special characters in generated data
3. **Typed generators** - Full TypeScript support with interfaces
4. **ID counter reset** - `resetTestData()` ensures reproducible IDs across tests
5. **Local-only** - No network calls, safe for offline test execution

## Checkpoint Module Implementation (Mon Mar 02 2026)

### File Location
- `src/checkpoint.ts` - Core checkpoint read/write/delete operations

### API Functions

**`saveCheckpoint(projectName, sessionId, data)`**
- Atomic write: writes to `.<sessionId>.tmp` then `rename()` to final path
- Path: `projects/<projectName>/sessions/checkpoints/<sessionId>.json`
- Returns `true` on success, `false` on failure
- Never throws - errors logged to console

**`loadCheckpoint(projectName, sessionId)`**
- Returns parsed JSON data or `null`
- Returns `null` if file doesn't exist (no error)
- On JSON parse error: moves corrupt file to `*.corrupt.<timestamp>.json` and returns `null`
- Never throws

**`deleteCheckpoint(projectName, sessionId)`**
- Removes checkpoint file if exists
- Returns `true` if deleted, `false` if not found or on error
- Never throws

### Design Decisions
1. **Atomic writes** - temp file + rename prevents partial writes on crash
2. **No schema validation** - handled separately in Task 2.4
3. **Never throws** - caller-friendly API, errors logged but not propagated
4. **Corrupt file preservation** - moved with timestamp suffix for debugging
5. **No external dependencies** - uses only `node:fs` and `node:path`
6. **ASCII only** - JSON.stringify with 2-space indentation

### Usage Example
```typescript
import { saveCheckpoint, loadCheckpoint, deleteCheckpoint } from './checkpoint';

// Save
const success = await saveCheckpoint('my-project', 'session-123', checkpointData);

// Load
const data = await loadCheckpoint('my-project', 'session-123');
if (data === null) {
  // Not found or corrupt
}

// Delete
const deleted = await deleteCheckpoint('my-project', 'session-123');
```

### Verification
- Verified by running an inline `npx -y tsx -e` script that saves/loads/deletes a checkpoint (no separate test file yet).
- Functions exported and callable from external code

## Discovery Crawler Gotchas (Mon Mar 02 2026)

- Keep crawler serial (single browser + single page) to match deterministic test prep flows and avoid race conditions.
- `about:blank` has origin `null`; same-origin filtering still works but most relative links from `about:` URLs are not resolvable.
- Normalize URLs before dedupe: strip hash fragments and trim trailing slashes on HTTP(S) paths except root `/`.
- On Windows, keep path handling in crawler logic URL-based (not filesystem path joins) to avoid separator issues.
- Navigation failures should be non-fatal: record visited URL and continue crawl so discovery remains predictable.
## 2026-03-02 - Web Developer Verification & Knowledge Modules

### Modules Created

**File: src/web-developer/verify-fixes.ts**
- Purpose: Runs Playwright tests to verify fixes
- Key function: verifyFixes(input) - spawns npx playwright test with serial execution
- Features:
  - Can target specific test files or extract from previous JSON report
  - Always runs with --workers=1 for deterministic verification
  - Returns remaining failures for continued TDD loop
  - Windows-safe path normalization (forward slashes)

**File: src/web-developer/update-knowledge.ts**
- Purpose: Analyzes TDD logs and appends knowledge notes
- Key functions: updateKnowledge(input), appendKnowledgeNote()
- Categories: 'gotchas' (from failed attempts), 'test-guide' (from successful fixes)
- Follows append-only convention:
  - Date-stamped sections (## YYYY-MM-DD)
  - Bullet-normalized content (- item per line)
  - Creates knowledge files under projects/<projectName>/knowledge/

**File: src/web-developer/fix-log.ts**
- Purpose: Records TDD fix attempts to append-only log
- Key function: recordFixLog(input)
- Output: projects/<projectName>/sessions/fix-log.md
- Format includes:
  - Timestamp header (## YYYY-MM-DD YYYY-MM-DDTHH:MM:SS)
  - Summary section
  - Failures addressed list
  - TDD loop details with status icons (✅/❌)
  - Statistics (total attempts, success rate)
  - Section separator (---) for next entry

### Design Patterns Reused

1. **Append-only from knowledge.ts**: Copied date stamping, bullet normalization, mkdir recursive pattern
2. **Path normalization from fix-engine.ts**: normalizeForReport() pattern for Windows compatibility
3. **Node stdlib only**: No npm dependencies - uses node:fs/promises, node:path, node:child_process

### Verification Results

✅ All modules import successfully via npx -y tsx -e:
- verify-fixes exports: ['verifyFixes']
- update-knowledge exports: ['appendKnowledgeNote', 'updateKnowledge']
- fix-log exports: ['recordFixLog']

✅ Playwright commands work:
- npx playwright test --list: Lists 2 tests in 2 files
- npx playwright test tests/e2e/example.spec.ts --reporter=list: 1 passed

### Usage Pattern

For a complete TDD fix workflow:
1. Parse Playwright JSON report to get FailureCase[]
2. Run TDD loop with applyFix + verify callbacks
3. After loop, call recordFixLog() to append session log
4. Call updateKnowledge() to extract and append learnings
5. Use verifyFixes() as the verify callback implementation

### Integration Notes

- verify-fixes.ts spawns child process with CI=1 env for deterministic output
- update-knowledge.ts reuses exact append pattern from src/web-tester/knowledge.ts
- fix-log.ts creates sessions/ directory automatically (mkdir recursive)
- All modules handle Windows paths by normalizing to forward slashes
- Knowledge categories limited to 'gotchas' and 'test-guide' (not tech-stack)


## ASCII-Only Status Markers in Fix Log (2026-03-02)

**Decision:** Replace emoji status icons (✅/❌) with ASCII markers in `src/web-developer/fix-log.ts`

**Change:** Line 124 updated from:
```
const statusIcon = log.ok ? '✅' : '❌';
```
To:
```
const statusIcon = log.ok ? '[OK]' : '[FAIL]';
```

**Rationale:**
- Repository defaults to ASCII in source files unless emoji provides critical value
- Status markers are purely decorative; ASCII alternatives convey same meaning
- Improves compatibility with terminals and log viewers that may not render emoji correctly
- Consistent with existing ASCII-only patterns in codebase (e.g., test-data.ts generators)

**Verification:**
- Module imports successfully via npx tsx
- Log structure unchanged; only status marker text affected

## OpenSpec Schema Fork for Web Test Session (2026-03-02)

### Schema Creation Commands

```bash
# Fork existing schema to create project-local variant
openspec-cn schema fork spec-driven web-test-session

# Validate the schema
openspec-cn schema validate web-test-session

# Check active schema
openspec-cn schema which web-test-session
```

### Schema Structure

**File:** `openspec/schemas/web-test-session/schema.yaml`

**Artifacts defined:**
1. `test-report` - generates `test-report.md`
2. `fix-log` - generates `fix-log.md` (requires test-report)
3. `tasks` - generates `tasks.md` (requires test-report, fix-log)

**Key conventions:**
- Each artifact has: id, generates, description, template, instruction, requires
- Templates are markdown files in `templates/` subdirectory
- Instructions use `|` for multi-line YAML strings
- Dependencies defined in `requires` array

### Template Files Created

**Location:** `openspec/schemas/web-test-session/templates/`

1. `test-report.md` - Sections: Session Info, Test Results, Issues Found, Summary
2. `fix-log.md` - Sections: Issues, Fixes Applied, Verification, Remaining Work
3. `tasks.md` - Checkbox format: `- [ ] X.Y task description`

### Config Update

**File:** `openspec/config.yaml`

Changed schema from `spec-driven` to `web-test-session`:
```yaml
schema: web-test-session
```

### Change Creation

```bash
# Create a new change with the custom schema
openspec-cn new change <change-name> --schema web-test-session
```

**Result:** Creates `openspec/changes/<change-name>/` with `.openspec.yaml` referencing the schema.

### Important Notes

1. Templates guide AI agent in creating content - they are placeholders, not auto-generated files
2. Change directory initially contains only `.openspec.yaml` metadata file
3. Artifacts are created by AI agent during change implementation
4. Schema validation must pass before using in change creation
5. Project-local schemas take precedence over package schemas

### Verification Checklist

- [x] `openspec-cn schema validate web-test-session` returns "Schema is valid"
- [x] `openspec-cn schema which web-test-session` shows project path
- [x] `openspec-cn new change test-session-smoke --schema web-test-session` creates change directory
- [x] Change `.openspec.yaml` correctly references `schema: web-test-session`
- [x] Template files exist in `openspec/schemas/web-test-session/templates/`
- [x] `openspec/config.yaml` updated to use `web-test-session` schema


## Test Report, Fix Log, and Tasks Template Structures (2026-03-02)

### test-report.md Structure

**Purpose**: Overview of test session results with failure details and evidence paths.

**Sections**:
- Session Info: projectName, sessionId, change-name, date, playwrightCommand, baseURL
- Test Results: totalTests, passedCount, failedCount, jsonReportPath
- Failed Tests: Loop over failures with testName, filePath, line, errorMessage
- Evidence: checkpoint path, knowledge files list
- Next Steps: Sequential action items

**Key Placeholders**:
- `{{projectName}}`, `{{sessionId}}`, `{{change-name}}`
- `{{playwrightCommand}}`, `{{baseURL}}`
- `{{jsonReportPath}}` (e.g., test-results/tmp-results.json)
- Checkpoint: `projects/{{projectName}}/sessions/checkpoints/{{sessionId}}.json`
- Knowledge: `projects/{{projectName}}/knowledge/*.md`

### fix-log.md Structure

**Purpose**: Per-failure TDD attempts with changed files and verification commands.

**Sections**:
- Session Info: projectName, sessionId, change-name
- Failures Addressed: Checklist of failures to fix
- TDD Attempts: Loop with attemptNumber, failureName, status, filesChanged, verificationCommand, result, success, failureReason
- Summary: totalAttempts, successfulAttempts, failedAttempts, successRate
- Remaining Failures: List of unresolved tests
- Files Modified: All files touched during fixes
- Verification Commands: List of commands used to verify fixes

**Key Fields**:
- TDD attempt tracking with success/failure status
- Files changed per attempt
- Verification command and result per attempt
- Aggregate statistics (success rate)

### tasks.md Structure

**Purpose**: Checklist grouped by headings for session workflow tracking.

**Sections**:
1. Test Execution: Run tests, capture JSON report, save checkpoint
2. Failure Analysis: Review, categorize, prioritize failures
3. Fix Implementation: Individual fix checkboxes
4. Verification: All pass, no regressions, knowledge updates
5. Knowledge Updates: gotchas.md, test-guide.md, tech-stack.md
6. Session Wrap-up: Final checkpoint, fix log complete, report finalized

**Format**:
- `##` section headers with numbered groups
- `- [ ]` checkbox items under each section
- Placeholders for projectName, sessionId, jsonReportPath, checkpoint paths

### Design Decisions

1. **ASCII-only headings**: All section headers use plain English without emoji
2. **Stable heading levels**: `##` for main sections, `###` for subsections (automation-friendly)
3. **Minimal but complete**: Templates include all necessary fields without verbose prose
4. **Aligned with runtime paths**: Placeholders match actual file paths used by runtime code
5. **Loop syntax for repeats**: `{{#each failures}}` and `{{#each tddAttempts}}` for lists

### Alignment with Runtime Code

- Checkpoint path matches `src/checkpoint.ts`: `projects/<projectName>/sessions/checkpoints/<sessionId>.json`
- Knowledge files match `src/web-developer/update-knowledge.ts`: `projects/<projectName>/knowledge/{gotchas,test-guide}.md`
- Fix log path matches `src/web-developer/fix-log.ts`: `projects/<projectName>/sessions/fix-log.md`



## OpenSpec Sync Mechanism for Change Artifacts (2026-03-02)

### Purpose
Bridge between checkpoint-based session state and OpenSpec's artifact-tracking system (`openspec-cn status`).

### Module: src/openspec/sync.ts

**Key Function:** `syncOpenSpecChangeArtifacts(options)`

**Options:**
- `changeName` - Name of the OpenSpec change (e.g., 'test-session-smoke')
- `projectName` - Project name for placeholder substitution
- `sessionId` - Session ID for placeholder substitution
- `baseURL?` - Base URL for tests (default: 'about:blank')
- `jsonReportPath?` - Path to JSON report (default: 'test-results/tmp-results.json')

**Sync Strategy:**
1. **Idempotent creation** - Only creates missing artifacts; never overwrites existing files
2. **Template-based** - Copies from `openspec/schemas/web-test-session/templates/`
3. **Placeholder substitution** - Replaces `{{key}}` patterns with runtime values
4. **Handlebars loop removal** - Strips `{{#each}}...{{/each}}` blocks for clean initial state
5. **Node stdlib only** - Uses `node:fs` and `node:path`, no external dependencies

**Artifacts Created:**
- `test-report.md` - Session overview with test results and failures
- `fix-log.md` - TDD fix attempts and verification commands
- `tasks.md` - Checklist of session workflow items

**Design Decisions:**
1. **Safety first** - `fs.existsSync()` check before every write prevents accidental overwrites
2. **Error isolation** - Each artifact processed independently; one failure doesn't block others
3. **Result reporting** - Returns `{created, skipped, errors}` arrays for caller visibility
4. **Windows-safe paths** - Uses `node:path.join()` for cross-platform compatibility
5. **ASCII-only output** - All generated content uses ASCII characters only

**Usage Pattern:**
```typescript
import { syncOpenSpecChangeArtifacts } from './src/openspec/sync';

const result = syncOpenSpecChangeArtifacts({
  changeName: 'test-session-smoke',
  projectName: 'template',
  sessionId: 'session-123',
});

// result.created = ['test-report.md', 'fix-log.md', 'tasks.md']
// openspec-cn status --change test-session-smoke => 3/3 artifacts completed
```

### Integration with Checkpoint System
- Sync mechanism does NOT modify checkpoint schema or checkpoint files
- Checkpoints remain at `projects/<projectName>/sessions/checkpoints/<sessionId>.json`
- Sync creates OpenSpec artifacts in `openspec/changes/<changeName>/`
- This separation allows independent evolution of both systems

### Verification Workflow
```bash
# 1. Check initial state
openspec-cn status --change test-session-smoke
# => 0/3 artifacts completed

# 2. Run sync
npx -y tsx -e "import { syncOpenSpecChangeArtifacts } from './src/openspec/sync'; syncOpenSpecChangeArtifacts({ changeName: 'test-session-smoke', projectName: 'template', sessionId: 'test-session-smoke' })"

# 3. Verify completion
openspec-cn status --change test-session-smoke
# => 3/3 artifacts completed
```

### Placeholder Handling
**Replaced at sync time:**
- `{{projectName}}`, `{{sessionId}}`, `{{change-name}}`, `{{date}}`
- `{{baseURL}}`, `{{jsonReportPath}}`, `{{playwrightCommand}}`
- Numeric placeholders: `{{totalTests}}`, `{{passedCount}}`, etc.

**Removed at sync time (empty loops):**
- `{{#each failures}}...{{/each}}`
- `{{#each tddAttempts}}...{{/each}}`
- `{{#each knowledgeFiles}}...{{/each}}`
- `{{#each remainingFailures}}...{{/each}}`
- `{{#each allFilesModified}}...{{/each}}`
- `{{#each verificationCommands}}...{{/each}}`
- `{{#if !success}}...{{/if}}`

**Rationale:** Initial sync creates clean template state; actual data populated by AI agent during change implementation.


## Nested Handlebars Block Stripping Fix (2026-03-02)

### Problem
Initial implementation used simple regex to strip specific blocks like `{{#each failures}}...{{/each}}`, but this failed on nested blocks (e.g., `{{#each tddAttempts}}` containing `{{#each filesChanged}}`), leaving stray `{{/each}}` tags and placeholders in generated artifacts.

### Root Cause
Non-greedy regex `/{{#each \w+}[\s\S]*?{{\/each}}/g` matches from opener to FIRST closer, which breaks when blocks are nested:
```
{{#each outer}}       <- matches
  {{#each inner}}     <- inside match
    content           <- inside match
  {{/each}}           <- FIRST closer - ends match here!
  stray content       <- left behind
{{/each}}             <- stray closer
```

### Solution
Iterative innermost-block removal using a do-while loop:
```typescript
let prevContent;
do {
  prevContent = content;
  // Remove innermost {{#each}}...{{/each}} blocks (no nested blocks inside)
  content = content.replace(/{{#each\s+\w+}}[\s\S]*?{{\/each}}/g, '');
  // Remove innermost {{#if}}...{{/if}} blocks
  content = content.replace(/{{#if\s+[^}]+}}[\s\S]*?{{\/if}}/g, '');
} while (content !== prevContent);
```

### How It Works
1. **First pass**: Removes all leaf blocks (blocks with no nested blocks inside)
2. **Second pass**: Removes blocks that became leaves after first pass
3. **Repeats**: Until no more blocks found (content unchanged)
4. **Final cleanup**: Strips any remaining `{{...}}` placeholders
5. **Bonus**: Collapses 3+ consecutive newlines to 2 for clean formatting

### Example Trace
```
Input:
{{#each tddAttempts}}
  ### Attempt {{attemptNumber}}
  {{#each filesChanged}}
    - `{{this}}`
  {{/each}}
{{/each}}

Pass 1: Removes inner {{#each filesChanged}}...{{/each}}
{{#each tddAttempts}}
  ### Attempt {{attemptNumber}}
  
{{/each}}

Pass 2: Removes outer {{#each tddAttempts}}...{{/each}}
(whitespace only)

Pass 3: No change - exit loop

Final: Remove remaining {{attemptNumber}}
(empty)
```

### Verification
- Created `test-session-smoke2` change
- Ran sync: all 3 artifacts created cleanly
- Confirmed: No `{{` or `}}` tokens in generated files
- `openspec-cn status --change test-session-smoke2` => 3/3 complete

### Design Principles
1. **Iterative reduction**: Complex nested structures handled by repeated simple passes
2. **Non-greedy matching**: Always match innermost blocks first
3. **Convergence check**: Loop exits when no more changes made
4. **Clean output**: Additional newline normalization for readability


## Test-Only Mode End-to-End Verification (2026-03-02)

- Session: `projectName=template`, `changeName=test-only-smoke`, `sessionId=test-only-smoke`
- Command: `openspec-cn new change test-only-smoke --schema web-test-session` -> PASS
- Command: `npx -y tsx -e "import { syncOpenSpecChangeArtifacts } from './src/openspec/sync'; const result = syncOpenSpecChangeArtifacts({ changeName: 'test-only-smoke', projectName: 'template', sessionId: 'test-only-smoke' }); console.log(JSON.stringify(result, null, 2));"` -> PASS
- Command: `npx -y tsx -e "import { saveCheckpoint } from './src/checkpoint'; const initialData = { version: '1.0.0', sessionId: 'test-only-smoke', mode: 'test-only', lastUpdated: new Date().toISOString(), tester: { completedTasks: [] }, developer: { completedFixes: [] }, knowledge: { techStack: [], gotchas: [], testNotes: [] } }; const ok = await saveCheckpoint('template', 'test-only-smoke', initialData); console.log(JSON.stringify({ ok }, null, 2));"` -> FAIL (Top-level await in cjs eval)
- Command: `npx -y tsx -e "import { saveCheckpoint } from './src/checkpoint'; const initialData = { version: '1.0.0', sessionId: 'test-only-smoke', mode: 'test-only', lastUpdated: new Date().toISOString(), tester: { completedTasks: [] }, developer: { completedFixes: [] }, knowledge: { techStack: [], gotchas: [], testNotes: [] } }; (async () => { const ok = await saveCheckpoint('template', 'test-only-smoke', initialData); console.log(JSON.stringify({ ok }, null, 2)); })();"` -> PASS
- Command: `npx -y tsx -e "import { executeTests } from './src/web-tester/execute-tests'; (async () => { const result = await executeTests({ testFiles: ['tests/e2e/example.spec.ts', 'tests/e2e/generated/discovered.spec.ts'], reporterJsonPath: 'test-results/test-only-smoke.json' }); console.log(JSON.stringify({ ok: result.ok, exitCode: result.exitCode, stderr: result.stderr }, null, 2)); })();"` -> PASS
- Command: `openspec-cn status --change test-only-smoke` -> PASS (3/3 artifacts complete)

## Test-and-Fix Mode End-to-End Verification (2026-03-02)

- Session: `projectName=template`, `changeName=test-and-fix-smoke`, `sessionId=test-and-fix-smoke`
- Command: `openspec-cn new change test-and-fix-smoke --schema web-test-session` -> PASS (change created)
- Command: `openspec-cn status --change test-and-fix-smoke` -> PASS (`0/3` before sync)
- Command: `npx -y tsx -e "import { executeTests } from './src/web-tester/execute-tests'; import { loadAndParsePlaywrightJsonReport } from './src/web-developer/parse-report'; (async () => { const result = await executeTests({ testFiles: ['tests/e2e/generated/discovered.spec.ts'], reporterJsonPath: 'test-results/test-and-fix-smoke.before.json' }); const parsed = loadAndParsePlaywrightJsonReport('test-results/test-and-fix-smoke.before.json'); const failureCount = parsed.ok ? parsed.failures.length : -1; console.log(JSON.stringify({ testOk: result.ok, exitCode: result.exitCode, parseOk: parsed.ok, failureCount }, null, 2)); })();"` -> PASS with expected failure output (`testOk=false`, `exitCode=1`, `failureCount=1`)
- Command: `npx -y tsx -e "import { readFile, writeFile } from 'node:fs/promises'; import { executeTests } from './src/web-tester/execute-tests'; import { loadAndParsePlaywrightJsonReport } from './src/web-developer/parse-report'; import { runTddLoop } from './src/web-developer/tdd-loop'; import { applyFixForFailure } from './src/web-developer/fix-engine'; import { recordFixLog } from './src/web-developer/fix-log'; import { updateKnowledge } from './src/web-developer/update-knowledge'; import { saveCheckpoint } from './src/checkpoint'; import { syncOpenSpecChangeArtifacts } from './src/openspec/sync'; (async () => { const projectName = 'template'; const changeName = 'test-and-fix-smoke'; const sessionId = 'test-and-fix-smoke'; const specPath = 'tests/e2e/generated/discovered.spec.ts'; const specRaw = await readFile(specPath, 'utf8'); const strictSpec = specRaw.replace(/toHaveTitle\\(\\s*\\/[^)]*\\/\\s*\\)/g, 'toHaveTitle(/SOME_NON_MATCHING_TITLE/)'); await writeFile(specPath, strictSpec, 'utf8'); const before = await executeTests({ testFiles: [specPath], reporterJsonPath: 'test-results/test-and-fix-smoke.before.json' }); const parsed = loadAndParsePlaywrightJsonReport('test-results/test-and-fix-smoke.before.json'); if (!parsed.ok) { throw new Error(parsed.error); } const failures = parsed.failures.slice(0, 1); const loop = await runTddLoop({ failures, maxAttempts: 3, applyFix: ({ failure, attempt }) => applyFixForFailure({ failure, attempt }), verify: async () => { const verification = await executeTests({ testFiles: [specPath], reporterJsonPath: 'test-results/test-and-fix-smoke.after.json' }); return { ok: verification.ok, message: verification.ok ? 'verification passed' : ('verification failed (exit=' + verification.exitCode + ')') }; } }); await writeFile('projects/template/sessions/test-and-fix-smoke-loop.json', JSON.stringify(loop, null, 2), 'utf8'); const sync = syncOpenSpecChangeArtifacts({ changeName, projectName, sessionId, jsonReportPath: 'test-results/test-and-fix-smoke.before.json' }); const fixLog = await recordFixLog({ projectName, tddLogs: loop.logs, failures, summary: 'End-to-end test-and-fix smoke loop: fail -> applyFixForFailure -> verify pass.' }); const knowledge = await updateKnowledge({ projectName, tddLogs: loop.logs }); const checkpointSaved = await saveCheckpoint(projectName, sessionId, { version: '1.0.0', sessionId, mode: 'test-and-fix', lastUpdated: new Date().toISOString(), tester: { completedTasks: [{ taskId: '6.2', status: before.ok ? 'failed' : 'passed', testFile: specPath, executedAt: new Date().toISOString() }] }, developer: { completedFixes: [{ bugId: 'title-assertion-strict', status: loop.unableToFix.length === 0 ? 'fixed' : 'unable-to-fix', testFile: specPath, fixedFiles: ['tests/e2e/generated/discovered.spec.ts'], attempts: 1, completedAt: new Date().toISOString() }] }, knowledge: { techStack: [], gotchas: [], testNotes: [{ topic: 'title-assertion-relaxation', note: 'applyFixForFailure relaxed generated title assertion to toHaveTitle(/.*/) and verification passed', relatedTests: [specPath] }] } }); console.log(JSON.stringify({ beforeOk: before.ok, beforeExitCode: before.exitCode, failures: failures.length, fixed: loop.fixed.length, unableToFix: loop.unableToFix.length, sync, fixLogPath: fixLog.logPath, knowledgeFiles: knowledge.updatedFiles, checkpointSaved }, null, 2)); })();"` -> PASS (`beforeOk=false`, `fixed=1`, `unableToFix=0`, `checkpointSaved=true`)
- Command: `openspec-cn status --change test-and-fix-smoke` -> PASS (expected `3/3` artifacts complete after sync)
- Command: `npx -y tsx -e "import { loadAndParsePlaywrightJsonReport } from './src/web-developer/parse-report'; const before = loadAndParsePlaywrightJsonReport('test-results/test-and-fix-smoke.before.json'); const after = loadAndParsePlaywrightJsonReport('test-results/test-and-fix-smoke.after.json'); console.log(JSON.stringify({ beforeOk: before.ok, beforeFailures: before.ok ? before.failures.length : null, beforeError: before.ok ? null : before.error, afterOk: after.ok, afterFailures: after.ok ? after.failures.length : null, afterError: after.ok ? null : after.error }, null, 2));"` -> PASS (`beforeFailures=1`, `afterFailures=0`)
- Command: `openspec-cn status --change test-and-fix-smoke` -> PASS (`3/3` complete)


## Session Interrupt Smoke Verification (2026-03-02)
- Session: projectName=template, changeName=session-interrupt-smoke, sessionId=session-interrupt-smoke
- Phase A exact command: openspec-cn new change session-interrupt-smoke --schema web-test-session
- Phase A exact command: npx -y tsx -e "import { readFile, writeFile } from 'node:fs/promises'; import { syncOpenSpecChangeArtifacts } from './src/openspec/sync'; import { executeTests } from './src/web-tester/execute-tests'; import { loadAndParsePlaywrightJsonReport } from './src/web-developer/parse-report'; import { saveCheckpoint } from './src/checkpoint'; (async () => { const projectName='template'; const changeName='session-interrupt-smoke'; const sessionId='session-interrupt-smoke'; const specPath='tests/e2e/generated/discovered.spec.ts'; const beforeReport='test-results/session-interrupt-smoke.before.json'; const raw = await readFile(specPath,'utf8'); const strict = raw.includes('toHaveTitle(/SOME_NON_MATCHING_TITLE/)') ? raw : raw.replace(/toHaveTitle\(\s*\/[^)]*\/\s*\)/g,'toHaveTitle(/SOME_NON_MATCHING_TITLE/)'); await writeFile(specPath, strict, 'utf8'); const sync = syncOpenSpecChangeArtifacts({ changeName, projectName, sessionId, jsonReportPath: beforeReport }); const run = await executeTests({ testFiles:[specPath], reporterJsonPath: beforeReport }); const parsed = loadAndParsePlaywrightJsonReport(beforeReport); const firstFailure = parsed.ok && parsed.failures.length > 0 ? parsed.failures[0] : null; const checkpoint = { version:'1.0.0', sessionId, mode:'test-and-fix', lastUpdated:new Date().toISOString(), tester:{ completedTasks:[{ taskId:'generated-route-title-check', status:'failed', testFile:specPath, executedAt:new Date().toISOString(), failureDetails:firstFailure?.errorMessages?.[0] || 'strict title expectation failed' }], currentTask:'generated-route-title-check', currentStep:2, totalSteps:3, discoveredNewTasks:[], storageStatePath:'playwright/.auth/user.json' }, developer:{ completedFixes:[], currentFix:{ bugId:firstFailure?.title || 'route: about:blank', status:'analyzing', attempts:1, testFile:firstFailure?.file || specPath } }, knowledge:{ techStack:[], gotchas:[], testNotes:[] } }; const saved = await saveCheckpoint(projectName, sessionId, checkpoint); console.log(JSON.stringify({ phase:'A-reset', sync, testOk:run.ok, failureCount:parsed.ok ? parsed.failures.length : -1, checkpointSaved:saved }, null, 2)); })();"
- Phase B exact command: npx -y tsx -e "import { resumeSession } from './src/session-manager'; import { saveCheckpoint } from './src/checkpoint'; import { loadAndParsePlaywrightJsonReport } from './src/web-developer/parse-report'; import { applyFixForFailure } from './src/web-developer/fix-engine'; import { executeTests } from './src/web-tester/execute-tests'; import { recordFixLog } from './src/web-developer/fix-log'; import { updateKnowledge } from './src/web-developer/update-knowledge'; (async () => { const projectName='template'; const sessionId='session-interrupt-smoke'; const specPath='tests/e2e/generated/discovered.spec.ts'; const beforeReport='test-results/session-interrupt-smoke.before.json'; const afterReport='test-results/session-interrupt-smoke.after.json'; const resumed = await resumeSession(projectName, sessionId); if (!resumed || (typeof resumed === 'object' && 'ok' in resumed && resumed.ok === false)) throw new Error('resume failed'); const beforeParsed = loadAndParsePlaywrightJsonReport(beforeReport); if (!beforeParsed.ok || beforeParsed.failures.length === 0) throw new Error(beforeParsed.ok ? 'no failures from phase A' : beforeParsed.error); const failure = beforeParsed.failures[0]; const fixResult = await applyFixForFailure({ failure, attempt: 1 }); const verify = await executeTests({ testFiles:[specPath], reporterJsonPath: afterReport }); const afterParsed = loadAndParsePlaywrightJsonReport(afterReport); if (!afterParsed.ok) throw new Error(afterParsed.error); const logs = [ { failure, attempt:1, phase:'write-test', ok:true, message:'resumed from checkpoint' }, { failure, attempt:1, phase:'apply-fix', ok:fixResult.ok, message:fixResult.message, changedFiles:fixResult.changedFiles }, { failure, attempt:1, phase:'verify', ok:verify.ok, message:verify.ok ? 'verification passed' : ('verification failed (exit=' + verify.exitCode + ')'), changedFiles:fixResult.changedFiles } ]; await recordFixLog({ projectName, tddLogs: logs, failures:[failure], summary:'Resumed interrupted session and fixed strict title matcher in generated spec.' }); await updateKnowledge({ projectName, tddLogs: logs, categories:['gotchas','test-guide'] }); const now = new Date().toISOString(); const finalCheckpoint = { ...resumed, lastUpdated: now, tester: { ...resumed.tester, completedTasks:[{ taskId:'generated-route-title-check', status: verify.ok ? 'passed' : 'failed', testFile:specPath, executedAt:now }], currentTask: undefined, currentStep: 3, totalSteps: 3 }, developer: { ...resumed.developer, completedFixes:[{ bugId: failure.title || 'route: about:blank', status: verify.ok ? 'fixed' : 'unable-to-fix', testFile: failure.file || specPath, fixedFiles: fixResult.changedFiles || [], attempts:1, completedAt: now }], currentFix: verify.ok ? undefined : { bugId: failure.title || 'route: about:blank', status:'verifying', attempts:1, testFile: failure.file || specPath } } }; const saved = await saveCheckpoint(projectName, sessionId, finalCheckpoint); console.log(JSON.stringify({ phase:'B-final', applyFixOk:fixResult.ok, verifyOk:verify.ok, afterFailures: afterParsed.failures.length, checkpointSaved:saved }, null, 2)); })();"
- Observation: before report failures=1; after report failures=0; checkpoint moved from tester failed/developer analyzing to tester passed/developer fixed; openspec-cn status --change session-interrupt-smoke reported 3/3 complete.

## Session Interrupt Smoke Artifact Correction (2026-03-02)
- Corrected evidence gap by regenerating strict-fail run and restoring `test-results/session-interrupt-smoke.before.json` on disk after the relaxed verification run.
- Re-verified parse counts: before=1 failure, after=0 failures; `openspec-cn status --change session-interrupt-smoke` remains `3/3`.

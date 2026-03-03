# Web Testing + Fix Loop Template

> A local template for two agent skills: `web-tester` (E2E testing) and `web-developer` (TDD fix loop)

[English](README.md) | [中文](README.zh-CN.md)

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BigRedBut 项目架构                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          .opencode/skills/                               │   │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐  │   │
│  │  │   web-tester    │    │  web-developer  │    │    _skill-core      │  │   │
│  │  │    (测试技能)    │◄──►│    (修复技能)    │◄──►│   (共享运行时)       │  │   │
│  │  │                 │    │                 │    │                     │  │   │
│  │  │ • execute-tests │    │ • parse-report  │    │ • checkpoint        │  │   │
│  │  │ • discover      │    │ • tdd-loop      │    │ • session-manager   │  │   │
│  │  │ • generate-tests│    │ • fix-engine    │    │ • execution-context │  │   │
│  │  │ • orchestrator  │    │ • verify-fixes  │    │ • validator         │  │   │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │   Playwright   ────►   JSON Report   ────►   Parse Failures   ────►     │   │
│  │        │                    │                   │              TDD Loop │   │
│  │        │                    │                   │                 │     │   │
│  │        ▼                    ▼                   ▼                 ▼     │   │
│  │   [tests/e2e/]      [test-results/*.json]  [FailureCase[]]   [Fix Log] │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │   Persistence:  projects/<name>/sessions/checkpoints/*.json             │   │
│  │   Knowledge:    projects/<name>/knowledge/{tech-stack,gotchas,test-guide}.md │
│  │   OpenSpec:     openspec/schemas/web-test-session/*.yaml                 │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm / npx
- `openspec-cn` CLI (optional)

### Install
```bash
npm install
npx playwright install chromium
```

### Basic Usage

**test-only mode** (只测试，不修复):
```bash
npx -y tsx -e "
import { executeTests } from './src/web-tester/execute-tests';
const r = await executeTests({
  testFiles: ['tests/e2e/example.spec.ts'],
  reporterJsonPath: 'test-results/example.json'
});
console.log(r.ok ? 'PASSED' : 'FAILED');
"
```

**test-and-fix mode** (测试 + 自动修复):
```bash
npx -y tsx -e "
import { runTestAndFixFlow } from './src/orchestrator';
const result = await runTestAndFixFlow({
  projectName: 'my-app',
  mode: 'test-and-fix',
  testFiles: ['tests/e2e/**/*.spec.ts']
});
console.log(result);
"
```

---

## Core Architecture

### Layer Model

| Layer | Purpose | Key Files |
|-------|---------|-----------|
| **Test Execution** | Run Playwright tests, collect JSON reports | `web-tester/execute-tests.ts` |
| **Failure Parsing** | Parse JSON → `FailureCase[]` | `web-developer/parse-report.ts` |
| **TDD Fix Loop** | RED → GREEN → REFACTOR (max 3 attempts) | `web-developer/tdd-loop.ts`, `fix-engine.ts` |
| **Persistence** | Save/Load checkpoints, session management | `checkpoint.ts`, `session-manager.ts` |
| **Knowledge** | Append-only notes (gotchas, test-guide) | `web-developer/update-knowledge.ts` |
| **OpenSpec** | Change artifacts scaffolding | `openspec/sync.ts` |

### Workflow: test-and-fix

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          test-and-fix 工作流时序图                                │
└─────────────────────────────────────────────────────────────────────────────────┘

    User          Orchestrator        web-tester        web-developer      Checkpoint
      │                │                  │                   │                │
      │  run(options)  │                  │                   │                │
      │───────────────►│                  │                   │                │
      │                │                  │                   │                │
      │                │ initializeSession│                   │                │
      │                │─────────────────────────────────────────────────────►│
      │                │                  │                   │                │
      │                │   executeTests() │                   │                │
      │                │─────────────────►│                   │                │
      │                │                  │  npx playwright   │                │
      │                │◄─────────────────│  test             │                │
      │                │  ExecuteResult   │                   │                │
      │                │                  │                   │                │
      │                │ parseFailures()  │                   │                │
      │                │─────────────────────────────────────►│                │
      │                │◄─────────────────────────────────────│                │
      │                │                  │   FailureCase[]   │                │
      │                │                  │                   │                │
      │                │                  │    TDD Loop       │                │
      │                │                  │  (RED→GREEN→REF)  │                │
      │                │                  │   max 3 attempts  │                │
      │                │                  │                   │                │
      │                │            saveCheckpoint            │                │
      │                │─────────────────────────────────────────────────────►│
      │                │                  │                   │                │
      │◄───────────────│                  │                   │                │
      │ OrchestratorResult               │                   │                │
```

---

## TDD Fix Loop State Machine

```
                          ┌─────────────────┐
                          │    START        │
                          │  (接收失败案例)  │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │    RED          │
                          │  写/更新测试     │
                          │  确保测试失败    │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │    GREEN        │
                          │   实现修复      │
                          │  最小化变更      │
                          └────────┬────────┘
                                   │
                                   ▼
                     ┌─────────────────────────────┐
                     │         VERIFY              │
                     │       运行验证测试           │
                     └─────────────┬───────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
           ┌───────────────┐             ┌───────────────┐
           │   PASS        │             │    FAIL       │
           │  测试通过      │             │   测试失败     │
           └───────┬───────┘             └───────┬───────┘
                   │                             │
                   │                    ┌────────┴────────┐
                   │                    │                 │
                   │                    ▼                 ▼
                   │           ┌───────────────┐ ┌───────────────┐
                   │           │ attempt < 3   │ │ attempt >= 3  │
                   │           │  继续迭代      │ │  无法修复      │
                   │           └───────┬───────┘ └───────┬───────┘
                   │                   │                 │
                   ▼                   │                 ▼
           ┌─────────────────┐         │         ┌─────────────────┐
           │    REFACTOR     │◄────────┘         │  UNABLE_TO_FIX  │
           │   可选重构       │                   │   标记跳过       │
           └────────┬────────┘                   └─────────────────┘
                    │
                    ▼
           ┌─────────────────┐
           │     FIXED       │
           │   修复完成       │
           └─────────────────┘
```

---

## Directory Structure

```
bigRedBut/
├── .opencode/skills/              # 可迁移技能目录
│   ├── _skill-core/               # 共享运行时核心
│   │   └── src/
│   │       ├── checkpoint.ts      # 检查点管理
│   │       ├── session-manager.ts # 会话管理
│   │       └── execution-context.ts
│   │
│   ├── web-tester/                # 测试技能
│   │   └── src/
│   │       ├── execute-tests.ts   # Playwright 执行
│   │       ├── discover.ts        # 页面发现
│   │       └── orchestrator/      # 协作编排
│   │
│   └── web-developer/             # 修复技能
│       └── src/
│           ├── parse-report.ts    # 报告解析
│           ├── tdd-loop.ts        # TDD 循环
│           ├── fix-engine.ts      # 修复引擎
│           └── verify-fixes.ts    # 验证修复
│
├── src/                           # 遗留运行时(保留兼容)
│
├── openspec/
│   └── schemas/web-test-session/  # OpenSpec 工作流定义
│       ├── schema.yaml
│       └── templates/
│
├── projects/
│   └── template/
│       ├── knowledge/             # 知识库
│       └── sessions/checkpoints/  # 检查点存储
│
├── tests/e2e/                     # E2E 测试
├── playwright.config.ts
└── package.json
```

---

## Skill Usage

### `web-tester` Skill

**Purpose**: Execute E2E tests, discover pages, generate reports

```
使用 web-tester 技能，模式：test-only
项目：<projectName>
项目目录：<projectDir，可选>
```

**Key Functions**:
- `executeTests()` - Run Playwright tests
- `discover()` - Scan app pages
- `generateTests()` - Auto-generate test specs

### `web-developer` Skill

**Purpose**: Parse failures, TDD fix loop, verify, persist logs

```
使用 web-developer 技能
项目：<projectName>
会话：<sessionId>
测试报告：<path/to/test-report.md>
```

**Key Functions**:
- `parsePlaywrightJsonReport()` - Parse JSON → failures
- `runTddLoop()` - Execute RED→GREEN→REFACTOR
- `applyFixForFailure()` - Apply safe fix strategies
- `verifyFixes()` - Re-run tests for verification

---

## API Reference

### ExecutionContext

```typescript
interface ExecutionContext {
  projectDir?: string;  // Target code project directory
  cwd?: string;         // Working directory alias
  dataDir?: string;     // Data root for checkpoints/sessions
}
```

**Resolution Priority**: `explicit args > env vars > defaults`

### Checkpoint Data

```typescript
interface CheckpointData {
  version: '1.0.0';
  sessionId: string;
  mode: 'test-only' | 'test-and-fix';
  lastUpdated: string;
  tester: {
    completedTasks: Array<{
      taskId: string;
      status: 'passed' | 'failed';
      testFile: string;
    }>;
  };
  developer: {
    completedFixes: Array<{
      bugId: string;
      status: 'fixed' | 'unable-to-fix';
      attempts: number;
    }>;
  };
  knowledge: {
    techStack: string[];
    gotchas: string[];
    testNotes: string[];
  };
}
```

### FailureCase

```typescript
interface FailureCase {
  title: string;        // Test name
  file: string;         // Spec file path
  line?: number;        // Line number
  status: string;       // 'failed' | 'timedOut' | 'interrupted'
  errorMessages: string[];
}
```

---

## Migration Guide

To use these skills in another project, copy:

```
.opencode/skills/_skill-core/    # Required
.opencode/skills/web-tester/     # For testing
.opencode/skills/web-developer/  # For fixing
```

Optional:
- `playwright.config.ts`
- `projects/template/`

---

## Configuration

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright settings (testDir, workers, timeout) |
| `.env` | Environment variables (PLAYWRIGHT_TEST_BASE_URL, PROJECT_DIR) |
| `openspec/config.yaml` | Active schema selection |
| `openspec/schemas/web-test-session/schema.yaml` | Artifact definitions |

---

## Constraints

- No auto-commit behavior
- Max 3 fix attempts per failure
- Append-only knowledge files (never overwrite)
- Serial test execution (`workers=1`) for stability

---

## License

MIT
# Web Testing + Fix Loop 模板

> 本地模板，面向两个 agent 技能：`web-tester`（E2E 测试）和 `web-developer`（TDD 修复闭环）

[中文](README.zh-CN.md) | [English](README.md)

---

## 概览

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
│  │   持久化:  projects/<name>/sessions/checkpoints/*.json                  │   │
│  │   知识库:  projects/<name>/knowledge/{tech-stack,gotchas,test-guide}.md │   │
│  │   OpenSpec:     openspec/schemas/web-test-session/*.yaml                 │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 前置条件
- Node.js 20+
- npm / npx
- `openspec-cn` CLI（可选）

### 安装
```bash
npm install
npx playwright install chromium
```

### 基本用法

**test-only 模式**（只测试，不修复）:
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

**test-and-fix 模式**（测试 + 自动修复）:
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

## 核心架构

### 分层模型

| 层级 | 职责 | 关键文件 |
|------|------|----------|
| **测试执行层** | 执行 Playwright 测试，收集 JSON 报告 | `web-tester/execute-tests.ts` |
| **失败解析层** | 解析 JSON → `FailureCase[]` | `web-developer/parse-report.ts` |
| **TDD 修复层** | RED → GREEN → REFACTOR（最多 3 次尝试） | `web-developer/tdd-loop.ts`, `fix-engine.ts` |
| **持久化层** | 保存/加载检查点，会话管理 | `checkpoint.ts`, `session-manager.ts` |
| **知识层** | 追加式笔记（gotchas, test-guide） | `web-developer/update-knowledge.ts` |
| **OpenSpec 层** | 变更产物脚手架 | `openspec/sync.ts` |

### 工作流：test-and-fix

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

## TDD 修复循环状态机

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

## 目录结构

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

## 技能使用

### `web-tester` 技能

**用途**: 执行 E2E 测试，发现页面，生成报告

```
使用 web-tester 技能，模式：test-only
项目：<projectName>
项目目录：<projectDir，可选>
```

**关键函数**:
- `executeTests()` - 执行 Playwright 测试
- `discover()` - 扫描应用页面
- `generateTests()` - 自动生成测试规格

### `web-developer` 技能

**用途**: 解析失败，TDD 修复循环，验证，持久化日志

```
使用 web-developer 技能
项目：<projectName>
会话：<sessionId>
测试报告：<path/to/test-report.md>
```

**关键函数**:
- `parsePlaywrightJsonReport()` - 解析 JSON → 失败列表
- `runTddLoop()` - 执行 RED→GREEN→REFACTOR
- `applyFixForFailure()` - 应用安全修复策略
- `verifyFixes()` - 重新运行测试验证

---

## API 参考

### ExecutionContext

```typescript
interface ExecutionContext {
  projectDir?: string;  // 目标代码项目目录
  cwd?: string;         // 工作目录别名
  dataDir?: string;     // 检查点/会话数据根目录
}
```

**解析优先级**: `显式参数 > 环境变量 > 默认值`

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
  title: string;        // 测试名称
  file: string;         // 测试文件路径
  line?: number;        // 行号
  status: string;       // 'failed' | 'timedOut' | 'interrupted'
  errorMessages: string[];
}
```

---

## 迁移指南

将技能迁移到其他项目，复制以下目录：

```
.opencode/skills/_skill-core/    # 必须
.opencode/skills/web-tester/     # 测试功能
.opencode/skills/web-developer/  # 修复功能
```

可选：
- `playwright.config.ts`
- `projects/template/`

---

## 配置

| 文件 | 用途 |
|------|------|
| `playwright.config.ts` | Playwright 配置（testDir, workers, timeout） |
| `.env` | 环境变量（PLAYWRIGHT_TEST_BASE_URL, PROJECT_DIR） |
| `openspec/config.yaml` | 激活 schema 选择 |
| `openspec/schemas/web-test-session/schema.yaml` | 产出物定义 |

---

## 约束

- 无自动提交行为
- 每个失败最多 3 次修复尝试
- 知识文件追加式（永不覆盖）
- 串行测试执行（`workers=1`）保证稳定性

---

## 许可证

MIT
# Web Testing + Fix Loop 模板

语言索引：
- 中文：`README.zh-CN.md`
- English: `README.md`

本项目是一个本地模板，面向两个 agent 技能：
- `web-tester`：仅测试 / 测试并修复
- `web-developer`：基于 TDD 的修复与验证闭环

它包含 Playwright 测试执行、checkpoint 持久化、OpenSpec 变更产物脚手架。

## 1) 编程语言与选型逻辑

### 为什么是 TypeScript + Node.js
- TypeScript 适合表达 checkpoint、测试报告、TDD 日志等结构化状态。
- Node.js 原生支持本项目需要的能力：`fs`、`path`、`child_process`。
- Playwright 在 Node 生态成熟，自动化测试与报告集成成本低。

### 为什么选这组工具
- `@playwright/test`：E2E 测试执行与报告。
- `tsx`（通过 `npx -y tsx`）：直接执行 TypeScript 脚本，便于编排流程。
- `openspec-cn`：管理变更与产物模板。

## 2) 核心逻辑（如何选择与使用）

项目采用分层执行：

1. **测试执行层**
   - `src/web-tester/execute-tests.ts` 统一执行 `npx playwright test --workers=1`。
   - 支持输出 JSON 报告供后续解析。

2. **失败解析与 TDD 修复层**
   - `src/web-developer/parse-report.ts` 解析失败用例。
   - `src/web-developer/tdd-loop.ts` 驱动 `write-test -> apply-fix -> verify`。
   - `src/web-developer/fix-engine.ts` 提供可控修复策略。

3. **中断恢复层**
   - `src/checkpoint.ts`、`src/checkpoint-validator.ts`、`src/session-manager.ts` 负责持久化与恢复。
   - checkpoint 路径：`projects/<projectName>/sessions/checkpoints/<sessionId>.json`。

4. **知识沉淀层**
   - `src/web-developer/fix-log.ts` 追加修复日志。
   - `src/web-developer/update-knowledge.ts` 追加 gotchas/test-guide。

5. **OpenSpec 产物层**
   - `src/openspec/sync.ts` 保证变更目录下产物文件存在。
   - schema 位置：`openspec/schemas/web-test-session/`。

## 3) 目录结构

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

## 4) 快速开始

### 前置条件
- Node.js 20+
- npm / npx
- 已安装 `openspec-cn`

### 安装
```bash
npm install
npx playwright install chromium
```

### 基础自检
```bash
npx playwright --version
npx playwright test --list
npx playwright test tests/e2e/example.spec.ts --reporter=list
```

### 可选环境变量
从 `.env.example` 创建 `.env`，并按需设置：
- `PLAYWRIGHT_TEST_BASE_URL`
- `PLAYWRIGHT_BROWSERS_PATH=0`

## 5) 典型使用流程

### A. 仅测试（test-only）
1. 创建变更：`openspec-cn new change test-only-smoke --schema web-test-session`
2. 调用 `src/openspec/sync.ts` 同步产物模板
3. 执行测试并保存 JSON 报告
4. 保存 checkpoint

### B. 测试并修复（test-and-fix）
1. 跑测试并解析失败
2. 执行 TDD 循环（`runTddLoop` + `applyFixForFailure` + verify）
3. 追加 fix-log 与 knowledge
4. 保存 checkpoint，并检查 OpenSpec 状态

### C. 中断恢复（interrupt-resume）
1. Phase A 保存中间 checkpoint
2. Phase B 从 checkpoint 恢复
3. 持续循环直到验证通过

## 6) Skill 使用说明

### `web-tester` skill
用途：
- 面向测试阶段，执行 test-only 或修复前验证。

主要职责：
- 明确测试范围（全量或指定功能）。
- 执行 Playwright 测试并输出可解析报告。
- 保存 checkpoint，支持中断恢复。

关键文件：
- `.opencode/skills/web-tester/SKILL.md`
- `src/web-tester/execute-tests.ts`
- `src/web-tester/discover.ts`
- `src/web-tester/generate-tests.ts`

### `web-developer` skill
用途：
- 面向修复阶段，执行失败解析、TDD 修复循环与复测。

主要职责：
- 将 JSON 报告解析为失败用例。
- 按失败项执行受控修复，限制尝试次数。
- 复测并落盘 fix-log、knowledge、checkpoint。

关键文件：
- `.opencode/skills/web-developer/SKILL.md`
- `src/web-developer/parse-report.ts`
- `src/web-developer/tdd-loop.ts`
- `src/web-developer/fix-engine.ts`
- `src/web-developer/fix-log.ts`
- `src/web-developer/update-knowledge.ts`

## 7) 使用示例

### 示例 A：test-only 执行并输出 JSON
```bash
npx -y tsx -e "import { executeTests } from './src/web-tester/execute-tests'; (async () => { const r = await executeTests({ testFiles: ['tests/e2e/example.spec.ts'], reporterJsonPath: 'test-results/example.json' }); console.log(JSON.stringify({ ok: r.ok, exitCode: r.exitCode }, null, 2)); })();"
```

### 示例 B：创建 OpenSpec 变更并同步产物
```bash
openspec-cn new change my-session --schema web-test-session
npx -y tsx -e "import { syncOpenSpecChangeArtifacts } from './src/openspec/sync'; const r = syncOpenSpecChangeArtifacts({ changeName: 'my-session', projectName: 'template', sessionId: 'my-session' }); console.log(JSON.stringify(r, null, 2));"
openspec-cn status --change my-session
```

### 示例 C：保存并读取 checkpoint
```bash
npx -y tsx -e "import { saveCheckpoint, loadCheckpoint } from './src/checkpoint'; (async () => { await saveCheckpoint('template', 'demo-session', { version: '1.0.0', sessionId: 'demo-session', mode: 'test-only', lastUpdated: new Date().toISOString(), tester: { completedTasks: [] }, developer: { completedFixes: [] }, knowledge: { techStack: [], gotchas: [], testNotes: [] } }); const cp = await loadCheckpoint('template', 'demo-session'); console.log(cp ? 'loaded' : 'missing'); })();"
```

## 8) 配置文件说明

- `playwright.config.ts`
  - Playwright 核心配置：`testDir`、`workers`、`retries`、`timeout`、`outputDir`、`baseURL`、`projects`。
  - 若未设置 `PLAYWRIGHT_TEST_BASE_URL`，默认使用 `about:blank`。

- `.env.example`
  - 环境变量模板。
  - 包含 `PLAYWRIGHT_BROWSERS_PATH=0` 等运行参数示例。

- `openspec/config.yaml`
  - 指定 `openspec-cn` 使用的 schema（当前为 `web-test-session`）。

- `openspec/schemas/web-test-session/schema.yaml`
  - 定义变更必须产出的文档（`test-report`、`fix-log`、`tasks`）。

- `package.json`
  - 依赖定义（如 `@playwright/test`）。
  - 当前仓库主要通过 `npx` 命令编排流程，而不是 npm scripts。

## 9) 约束说明

- 默认用于受控测试环境，不建议直接用于生产环境测试。
- 未实现自动提交（auto-commit）。
- 当前 `package.json` 无 build 脚本，主要通过 `npx` 命令驱动。

## 10) 关键文件

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

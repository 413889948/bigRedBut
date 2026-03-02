# Web Testing + Development Skills System

## TL;DR
> **Summary**: 创建两个 OpenCode 技能（Web Tester + Web Developer），实现自动化 Web 项目测试与 TDD 驱动的 Bug 修复，支持可中断恢复和知识持久化
> **Deliverables**: 
> - `.opencode/skills/web-tester/SKILL.md` - 测试人员技能
> - `.opencode/skills/web-developer/SKILL.md` - 开发人员技能
> - Playwright 测试基础设施配置
> - 会话状态管理和知识持久化系统
> - 深度 OpenSpec 集成（测试会话作为变更）
> **Effort**: Large (预计 26 个任务)
> **Parallel**: YES - 6 waves (基础设施 → 状态管理 → Tester 技能 → Developer 技能 → OpenSpec 集成 → 完整验证)
> **Critical Path**: Playwright 配置 → Checkpoint 系统 → Tester 技能 → TDD 循环 → 完整流程验证

## Context

### Original Request
用户希望创建两个技能：
1. **测试人员 Skill** - 浏览 Web 项目，发现功能，拆分测试任务，执行测试，动态发现新测试点
2. **开发人员 Skill** - 基于测试报告，遵循 TDD 流程修复 Bug

核心需求：
- 两种模式：仅测试 / 测试 + 修复循环
- 可中断恢复：随时停止/重启，能从 checkpoint 继续
- 知识持久化：记录项目特殊点和注意事项，避免 token 浪费
- TDD 强制：必须先写测试再修复
- 深度 OpenSpec 集成：测试用例、报告、修复记录都是产出物

### Interview Summary
关键决策确认：
- **目标项目**: 用户自己的项目（有代码访问权限，可深度集成）
- **修复范围**: 前端 + 简单后端（API 调用、数据处理）
- **并行策略**: 单浏览器，串行测试（简单，资源占用少）
- **OpenSpec 集成**: 深集成（每个测试会话是变更，测试用例/报告/修复记录是产出物）

### Metis Review (关键发现)
Metis 识别出以下关键问题已纳入计划：
- **Guardrails**: 浏览器安全、代码修改安全、执行安全、OpenSpec 安全
- **Scope Boundaries**: 明确排除 WebSocket、实时功能、复杂认证流、微服务、视觉回归测试
- **Edge Cases**: 浏览器启动失败、checkpoint 损坏、测试 flaky、TDD 无限循环
- **Acceptance Criteria**: 功能性指标、性能指标、质量指标
- **Phased Rollout**: 4 阶段实施（只读测试 → 执行 → TDD → 完善）

## Work Objectives

### Core Objective
构建生产级自动化 Web 测试 + 开发技能系统，实现零人工干预的测试执行和 TDD 驱动的 Bug 修复循环。

### Deliverables
1. 两个完整功能的 OpenCode 技能（Tester + Developer）
2. Playwright 测试基础设施（配置 + fixtures）
3. 会话状态管理系统（checkpoint JSON）
4. 项目知识库结构（tech-stack、gotchas、test-guide）
5. OpenSpec 集成（测试会话变更模板）
6. 完整的 QA 验证场景

### Definition of Done (verifiable conditions)
```bash
# 1. 技能文件存在
ls .opencode/skills/web-tester/SKILL.md
ls .opencode/skills/web-developer/SKILL.md

# 2. Playwright 配置有效
npx playwright --version
npx playwright test --list

# 3. 测试执行成功
npx playwright test tests/e2e/example.spec.ts --reporter=list

# 4. Checkpoint 系统工作
ls projects/test-project/sessions/*.json

# 5. OpenSpec 变更创建成功
openspec-cn list | grep "test-"

# 6. 完整流程验证（test-and-fix 模式）
# 手动执行：创建变更 → 运行 tester → 运行 developer → 验证通过
```

### Must Have
- ✅ 两种模式：test-only 和 test-and-fix
- ✅ 可中断恢复：checkpoint 系统
- ✅ 知识持久化：项目特殊点记录
- ✅ TDD 强制：测试-before-修复
- ✅ 动态任务发现：测试中添加新测试点
- ✅ OpenSpec 深度集成
- ✅ 单浏览器串行执行
- ✅ 前端 + 简单后端修复

### Must NOT Have (guardrails)
- ❌ 生产环境测试（无明确确认）
- ❌ 自动提交代码（必须用户批准）
- ❌ 视觉回归测试（超出范围）
- ❌ 性能测试（超出范围）
- ❌ 无障碍测试（超出范围）
- ❌ 多浏览器并行（增加复杂度）
- ❌ WebSocket/实时功能测试
- ❌ 复杂认证流自动化

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.

- **Test decision**: tests-after（先实现技能，后写测试验证）
- **QA policy**: 每个任务有 agent-executed 场景（Playwright + Bash）
- **Evidence**: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves

**Wave 1: 基础设施准备 (4 任务)**
- 安装 Playwright 和依赖
- 创建测试目录结构
- 配置 Playwright
- 创建项目知识库模板

**Wave 2: 状态管理系统 (3 任务)**
- 设计 checkpoint JSON schema
- 实现 checkpoint 读写功能
- 创建会话管理器

**Wave 3: Web Tester 技能 (5 任务)**
- 技能骨架和模式选择
- 页面浏览和发现逻辑
- 测试任务拆分和生成
- 测试执行引擎
- 动态任务发现和知识记录

**Wave 4: Web Developer 技能 (5 任务)**
- 技能骨架和模式选择
- 测试报告解析
- TDD 循环实现
- 代码修复引擎
- 验证和知识库更新

**Wave 5: OpenSpec 集成 (3 任务)**
- 测试会话变更模板
- 产出物结构定义
- 状态同步机制

**Wave 6: 完整流程验证 (3 任务)**
- test-only 模式验证
- test-and-fix 模式验证
- 中断恢复验证

| 任务 | Wave | 依赖 | 阻塞 |
|-----|------|------|------|
| 1.1 Playwright 安装 | 1 | 无 | 1.2, 1.3 |
| 1.2 测试目录结构 | 1 | 1.1 | 3.3, 4.3 |
| 1.3 Playwright 配置 | 1 | 1.1 | 3.4, 4.4 |
| 1.4 知识库模板 | 1 | 无 | 3.5, 4.5 |
| 1.5 Git Ignore 配置 | 1 | 1.2 | 无 |
| 1.6 测试数据管理 | 1 | 1.2 | 3.4, 4.4 |
| 2.1 Checkpoint schema | 2 | 无 | 2.2, 2.3 |
| 2.2 Checkpoint 读写 | 2 | 2.1 | 3.x, 4.x |
| 2.3 会话管理器 | 2 | 2.2 | 3.x, 4.x |
| 2.4 Schema 验证迁移 | 2 | 2.2 | 3.x, 4.x |
| 3.1 Tester 骨架 | 3 | 2.3 | 3.2 |
| 3.2 页面发现 | 3 | 3.1 | 3.3 |
| 3.3 测试生成 | 3 | 3.2, 1.2 | 3.4 |
| 3.4 测试执行 | 3 | 3.3, 1.3, 1.6 | 3.5 |
| 3.5 动态发现 | 3 | 3.4, 1.4 | 5.x |
| 4.1 Developer 骨架 | 4 | 2.3 | 4.2 |
| 4.2 报告解析 | 4 | 4.1 | 4.3 |
| 4.3 TDD 循环 | 4 | 4.2, 1.3 | 4.4 |
| 4.4 修复引擎 | 4 | 4.3, 1.6 | 4.5 |
| 4.5 验证更新 | 4 | 4.4, 1.4 | 5.x |
| 5.1 变更模板 | 5 | 3.5, 4.5 | 5.2 |
| 5.2 产出物结构 | 5 | 5.1 | 5.3 |
| 5.3 状态同步 | 5 | 5.2 | 6.x |
| 6.1 test-only 验证 | 6 | 5.3 | 6.2 |
| 6.2 test-and-fix 验证 | 6 | 6.1 | 6.3 |
| 6.3 中断恢复验证 | 6 | 6.2 | 完成 |
| Wave | 任务数 | 类别 | 推荐 Agent |
|------|--------|------|-----------|
| 1 | 6 | 基础设施 | quick (全部) |
| 2 | 4 | 状态管理 | quick + artistry (schema 设计) |
| 3 | 5 | Tester 技能 | quick (骨架) + unspecified-high (核心逻辑) |
| 4 | 5 | Developer 技能 | quick (骨架) + unspecified-high (TDD 循环) |
| 5 | 3 | OpenSpec 集成 | quick (全部) |
| 6 | 3 | 验证 | unspecified-high (全部) |

## TODOs

### Wave 1: 基础设施准备

- [x] 1.1 安装 Playwright 和依赖

  **What to do**:
  - 使用 npm 安装 @playwright/test
  - 安装 Playwright 浏览器（Chromium）
  - 验证安装成功

  **Must NOT do**:
  - 不修改现有代码
  - 不创建测试文件（仅配置）

  **Recommended Agent Profile**:
  - Category: `quick` — 简单的包安装任务
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 1.2, 1.3 | Blocked By: 无

  **References**:
  - 外部：https://playwright.dev/docs/intro — Playwright 官方文档
  - 外部：https://playwright.dev/docs/browsers — 浏览器安装

  **Acceptance Criteria**:
  - [ ] `npm ls @playwright/test --depth=0` 显示 @playwright/test
  - [ ] `npx playwright --version` 返回版本号
  - [ ] `npx playwright install --dry-run` 显示浏览器状态

  **QA Scenarios**:
  ```
  Scenario: 验证 Playwright 安装
    Tool: interactive_bash
    Steps: 
      1. 运行 `npm install -D @playwright/test`
      2. 运行 `npx playwright --version`
      3. 运行 `npx playwright install chromium`
    Expected: 版本号显示，浏览器下载完成
    Evidence: .sisyphus/evidence/task-1.1-install.png

  Scenario: 验证失败处理
    Tool: interactive_bash
    Steps:
      1. 故意运行错误的包名 `npm install -D @playwright/wrong`
      2. 捕获错误信息
    Expected: 清晰的错误提示，建议正确的包名
    Evidence: .sisyphus/evidence/task-1.1-error.png
  ```

  **Commit**: YES | Message: `chore: add Playwright testing dependency` | Files: [package.json, package-lock.json]

---

- [x] 1.2 创建测试目录结构

  **What to do**:
  - 创建 tests/e2e/ 目录
  - 创建 tests/fixtures/ 目录
  - 创建 tests/e2e/example.spec.ts 示例文件
  - 创建 .gitignore 条目（忽略 test-results/）

  **Must NOT do**:
  - 不创建复杂测试（仅简单示例）
  - 不修改现有配置

  **Recommended Agent Profile**:
  - Category: `quick` — 简单的文件创建
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3.3 | Blocked By: 1.1

  **References**:
  - 模式：参考行业标准的 Playwright 目录结构
  - 外部：https://playwright.dev/docs/test-advanced — 高级测试结构

  **Acceptance Criteria**:
  - [ ] `tests/e2e/` 目录存在
  - [ ] `tests/fixtures/` 目录存在
  - [ ] `tests/e2e/example.spec.ts` 包含基本测试示例
  - [ ] `.gitignore` 包含 `test-results/` 和 `playwright-report/`

  **QA Scenarios**:
  ```
  Scenario: 验证目录结构
    Tool: Bash
    Steps:
      1. 运行 `ls -la tests/`
      2. 运行 `ls -la tests/e2e/`
      3. 运行 `ls -la tests/fixtures/`
    Expected: 所有目录存在，文件结构正确
    Evidence: .sisyphus/evidence/task-1.2-structure.png

  Scenario: 验证示例测试可运行
    Tool: interactive_bash
    Steps:
      1. 运行 `npx playwright test tests/e2e/example.spec.ts`
    Expected: 测试执行成功（通过或失败都可以，只要能运行）
    Evidence: .sisyphus/evidence/task-1.2-run.png
  ```

  **Commit**: YES | Message: `chore: create Playwright test directory structure` | Files: [tests/e2e/example.spec.ts, tests/fixtures/base.ts, .gitignore]

---

- [x] 1.3 配置 Playwright

  **What to do**:
  - 创建 playwright.config.ts 配置文件
  - 配置单浏览器串行执行模式
  - 配置超时时间（5 分钟）
  - 配置重试次数（CI 环境 3 次，本地 0 次）
  - 配置 storageState 路径（用于会话持久化）

  **Must NOT do**:
  - 不配置多浏览器并行（违反需求）
  - 不配置视觉回归（超出范围）

  **Recommended Agent Profile**:
  - Category: `quick` — 配置文件创建
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3.4, 4.3, 4.4 | Blocked By: 1.1

  **References**:
  - 外部：https://playwright.dev/docs/test-configuration — 配置文档
  - 外部：https://playwright.dev/docs/test-parallel — 并行配置
  - 外部：https://playwright.dev/docs/auth — storageState 配置

  **Acceptance Criteria**:
  - [ ] `playwright.config.ts` 文件存在且语法正确
  - [ ] 配置 `workers: 1`（串行执行）
  - [ ] 配置 `timeout: 5 * 60 * 1000`（5 分钟超时）
  - [ ] 配置 `retries: process.env.CI ? 3 : 0`
  - [ ] 配置 `storageState` 路径为 `playwright/.auth/user.json`
  - [ ] 配置 `testDir: 'tests/e2e'`
  - [ ] 配置 `outputDir: 'test-results'`

  **QA Scenarios**:
  ```
  Scenario: 验证配置文件语法
    Tool: interactive_bash
    Steps:
      1. 运行 `npx tsc --noEmit playwright.config.ts`
    Expected: TypeScript 编译无错误
    Evidence: .sisyphus/evidence/task-1.3-tsc.png

  Scenario: 验证配置加载
    Tool: interactive_bash
    Steps:
      1. 运行 `npx playwright test --list`
    Expected: 成功列出测试，无配置错误
    Evidence: .sisyphus/evidence/task-1.3-list.png
  ```

  **Commit**: YES | Message: `chore: add Playwright configuration` | Files: [playwright.config.ts]

---

- [x] 1.4 创建项目知识库模板

  **What to do**:
  - 创建 `projects/{project-name}/knowledge/` 目录结构
  - 创建 tech-stack.md 模板
  - 创建 gotchas.md 模板
  - 创建 test-guide.md 模板
  - 创建 `projects/{project-name}/sessions/` 目录（用于 checkpoint）
  - 创建 `projects/{project-name}/sessions/checkpoints/` 目录

  **Must NOT do**:
  - 不填充实际内容（仅模板）
  - 不创建具体项目的知识库

  **Recommended Agent Profile**:
  - Category: `quick` — 模板文件创建
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3.5, 4.5 | Blocked By: 无

  **References**:
  - 内部：Metis 分析中的知识持久化建议
  - 模式：分离静态知识（tech-stack/gotchas/test-guide）和动态状态（sessions）

  **Acceptance Criteria**:
  - [ ] `projects/template/knowledge/tech-stack.md` 存在，包含技术栈列表模板
  - [ ] `projects/template/knowledge/gotchas.md` 存在，包含已知问题模板
  - [ ] `projects/template/knowledge/test-guide.md` 存在，包含测试注意事项模板
  - [ ] `projects/template/sessions/` 目录存在
  - [ ] `projects/template/sessions/checkpoints/` 目录存在
  - [ ] 所有模板文件包含清晰的填写说明

  **QA Scenarios**:
  ```
  Scenario: 验证目录结构
    Tool: Bash
    Steps:
      1. 运行 `find projects/template -type d`
      2. 运行 `find projects/template -type f`
    Expected: 所有目录和文件存在
    Evidence: .sisyphus/evidence/task-1.4-structure.png

  Scenario: 验证模板内容
    Tool: Bash
    Steps:
      1. 运行 `cat projects/template/knowledge/tech-stack.md`
    Expected: 包含占位符和填写说明
    Evidence: .sisyphus/evidence/task-1.4-content.png
  ```

  **Commit**: YES | Message: `chore: create project knowledge base templates` | Files: [projects/template/knowledge/*.md]


---

- [x] 1.5 配置 Git Ignore 和清理策略

  **What to do**:
  - 更新 .gitignore 添加测试相关忽略项
  - 决定哪些文件应该提交（knowledge/）哪些忽略（sessions/*.json）
  - 添加 .prettierignore 或 .eslintignore（如需要）
  - 创建 .env.example 文件（包含 PLAYWRIGHT_BROWSERS_PATH 等）

  **Must NOT do**:
  - 不忽略 knowledge 目录（需要提交）
  - 必须忽略 `playwright/.auth/`（storageState 可能包含敏感 cookie/headers，不应提交）

  **Recommended Agent Profile**:
  - Category: `quick` — 配置文件更新
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 无 | Blocked By: 1.2

  **References**:
  - 内部：1.2 创建的目录结构
  - 外部：https://playwright.dev/docs/test-configuration#ignore-files — Playwright 忽略配置

  **Acceptance Criteria**:
  - [ ] `.gitignore` 包含 `test-results/`, `playwright-report/`, `projects/*/sessions/*.json`
  - [ ] `.gitignore` **不**包含 `projects/*/knowledge/`（需要提交）
  - [ ] `.gitignore` 包含 `playwright/.auth/`（不提交 storageState；本地仍可复用）
  - [ ] `.env.example` 包含 `PLAYWRIGHT_BROWSERS_PATH=0`（全局安装浏览器）
  - [ ] 提交决策有文档说明（为什么某些文件要提交/忽略）

  **QA Scenarios**:
  ```
  Scenario: 验证 git ignore 配置
    Tool: Bash
    Steps:
      1. 运行 `git status --ignored`
      2. 验证 test-results/ 在 ignored 列表中
      3. 验证 projects/*/knowledge/ 不在 ignored 列表中
    Expected: 正确的文件被忽略，knowledge 文件可提交
    Evidence: .sisyphus/evidence/task-1.5-gitignore.png
  ```

  **Commit**: YES | Message: `chore: add test artifacts to gitignore` | Files: [.gitignore, .env.example]

---

- [x] 1.6 创建测试数据管理工具

  **What to do**:
  - 创建 `tests/fixtures/test-data.ts` 文件
  - 实现 mock 数据生成器函数
  - 实现数据库 seeding/reset 脚本（如适用）
  - 实现 API mock 配置（使用 MSW 或 Playwright 拦截）
  - 实现测试数据清理函数

  **Must NOT do**:
  - 不使用真实用户数据
  - 不依赖外部测试数据服务

  **Recommended Agent Profile**:
  - Category: `quick` — 测试工具创建
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3.4, 4.4 | Blocked By: 1.2

  **References**:
  - 外部：https://playwright.dev/docs/mock — Playwright Mock
  - 外部：https://mswjs.io/ — Mock Service Worker

  **Acceptance Criteria**:
  - [ ] `tests/fixtures/test-data.ts` 存在
  - [ ] 包含 mock 用户数据生成器（generateUser(), generateUsers(count)）
  - [ ] 包含 mock 文章/产品数据生成器（根据项目类型）
  - [ ] 包含 `resetTestData()` 函数（重置到初始状态）
  - [ ] 包含 `seedTestData()` 函数（填充测试数据）
  - [ ] 所有生成器函数有 TypeScript 类型定义

  **QA Scenarios**:
  ```
  Scenario: 验证测试数据生成
    Tool: interactive_bash
    Steps:
      1. 调用 generateUser()
      2. 验证返回对象包含必要字段（id, email, password）
      3. 调用 resetTestData()
      4. 验证数据已重置
    Expected: 数据生成和重置工作正常
    Evidence: .sisyphus/evidence/task-1.6-data.png
  ```

  **Commit**: YES | Message: `feat: add test data management utilities` | Files: [tests/fixtures/test-data.ts]


---

### Wave 2: 状态管理系统（续）

- [x] 2.1 设计 Checkpoint JSON Schema
  - **Category**: `artistry` — 需要设计思维
  - **Blocks**: 2.2, 2.3 | **Blocked By**: 无
  - **Acceptance**: Schema 包含所有必要字段，通过 JSON Schema 验证

- [x] 2.2 实现 Checkpoint 读写功能
  - **Category**: `quick` — 简单的文件操作
  - **Blocks**: 2.3 | **Blocked By**: 2.1
  - **Acceptance**: save/load/delete 函数工作正常，原子写入验证通过

- [x] 2.3 创建会话管理器
  - **Category**: `quick` — 状态管理逻辑
  - **Blocks**: 3.1, 4.1 | **Blocked By**: 2.2
  - **Acceptance**: create/resume/close/list 函数工作正常


---

- [x] 2.4 Checkpoint Schema 验证和迁移

  **What to do**:
  - 创建 JSON Schema 文件 `checkpoint-schema.json`
  - 实现 validateCheckpoint(data) 函数
  - 实现 migrateCheckpoint(oldData, fromVersion, toVersion) 函数
  - 在 loadCheckpoint 时自动验证
  - 添加 schema version 字段（从 v1 开始）
  - 实现向后兼容的迁移策略

  **Must NOT do**:
  - 不破坏现有 checkpoint 文件
  - 不跳过版本验证

  **Recommended Agent Profile**:
  - Category: `quick` — Schema 验证实现
  - Skills: [] — 无需特殊技能

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 3.x, 4.x | Blocked By: 2.2

  **References**:
  - 内部：2.1 设计的 schema
  - 外部：https://json-schema.org/ — JSON Schema 规范
  - 外部：https://github.com/ajv-validator/ajv — JSON Schema 验证器

  **Acceptance Criteria**:
  - [ ] `projects/template/checkpoint-schema.json` 存在且有效
  - [ ] Schema 包含 $schema 和 version 字段
  - [ ] validateCheckpoint 函数存在且能验证 JSON 数据
  - [ ] migrateCheckpoint 函数存在且能迁移不同版本的数据
  - [ ] loadCheckpoint 在验证失败时返回错误（不抛出异常）
  - [ ] 验证失败时提供清晰的错误信息（哪个字段不符合 schema）

  **QA Scenarios**:
  ```
  Scenario: 验证 Schema 验证
    Tool: interactive_bash
    Steps:
      1. 创建有效的 checkpoint 数据
      2. 调用 validateCheckpoint(validData)
      3. 创建无效数据（缺少必填字段）
      4. 调用 validateCheckpoint(invalidData)
    Expected: 有效数据通过验证，无效数据返回错误
    Evidence: .sisyphus/evidence/task-2.4-validate.png

  Scenario: 验证版本迁移
    Tool: interactive_bash
    Steps:
      1. 创建 v1 版本的 checkpoint（缺少某些字段）
      2. 调用 migrateCheckpoint(v1Data, 'v1', 'v2')
      3. 验证迁移后的数据包含新字段
    Expected: 迁移成功，新字段有默认值
    Evidence: .sisyphus/evidence/task-2.4-migrate.png
  ```

  **Commit**: YES | Message: `feat: add checkpoint schema validation and migration` | Files: [projects/template/checkpoint-schema.json, src/checkpoint-validator.ts]

### Wave 3: Web Tester 技能

- [x] 3.1 Tester 技能骨架
  - **Category**: `quick` — SKILL.md 创建
  - **Blocks**: 3.2 | **Blocked By**: 2.3
  - **Acceptance**: SKILL.md 包含两种模式选择逻辑

- [x] 3.2 页面浏览和发现逻辑
  - **Category**: `unspecified-high` — 复杂浏览逻辑
  - **Blocks**: 3.3 | **Blocked By**: 3.1
  - **Acceptance**: 能发现所有路由和主要功能模块

- [x] 3.3 测试任务拆分和生成
  - **Category**: `unspecified-high` — 测试生成逻辑
  - **Blocks**: 3.4 | **Blocked By**: 3.2, 1.2
  - **Acceptance**: 生成有效的 Playwright 测试文件

- [x] 3.4 测试执行引擎
  - **Category**: `unspecified-high` — 测试执行逻辑
  - **Blocks**: 3.5 | **Blocked By**: 3.3, 1.3
  - **Acceptance**: 执行测试并捕获结果

- [x] 3.5 动态任务发现和知识记录
  - **Category**: `unspecified-high` — 动态逻辑
  - **Blocks**: 5.1 | **Blocked By**: 3.4, 1.4
  - **Acceptance**: 发现新测试点并加入任务列表，记录到知识库

### Wave 4: Web Developer 技能

- [x] 4.1 Developer 技能骨架
  - **Category**: `quick` — SKILL.md 创建
  - **Blocks**: 4.2 | **Blocked By**: 2.3
  - **Acceptance**: SKILL.md 包含 TDD 流程

- [x] 4.2 测试报告解析
  - **Category**: `quick` — 报告解析
  - **Blocks**: 4.3 | **Blocked By**: 4.1
  - **Acceptance**: 解析 Playwright 测试报告

- [x] 4.3 TDD 循环实现
  - **Category**: `unspecified-high` — 核心 TDD 逻辑
  - **Blocks**: 4.4 | **Blocked By**: 4.2, 1.3
  - **Acceptance**: RED→GREEN→REFACTOR 循环工作，最多 3 次尝试

- [x] 4.4 代码修复引擎
  - **Category**: `unspecified-high` — 代码分析和修复
  - **Blocks**: 4.5 | **Blocked By**: 4.3
  - **Acceptance**: 能定位并修复前端 + 简单后端问题

- [ ] 4.5 验证和知识库更新
  - **Category**: `quick` — 验证逻辑
  - **Blocks**: 5.1 | **Blocked By**: 4.4, 1.4
  - **Acceptance**: 运行测试验证修复，更新知识库

### Wave 5: OpenSpec 集成

- [ ] 5.1 测试会话变更模板
  - **Category**: `quick` — 模板创建
  - **Blocks**: 5.2 | **Blocked By**: 3.5, 4.5
  - **Acceptance**: 创建变更模板，包含所有必要产出物

- [ ] 5.2 产出物结构定义
  - **Category**: `quick` — 结构定义
  - **Blocks**: 5.3 | **Blocked By**: 5.1
  - **Acceptance**: 定义 test-report.md、fix-log.md 等产出物格式

- [ ] 5.3 状态同步机制
  - **Category**: `quick` — 状态同步
  - **Blocks**: 6.x | **Blocked By**: 5.2
  - **Acceptance**: OpenSpec 状态与 checkpoint 同步

### Wave 6: 完整流程验证

- [ ] 6.1 test-only 模式验证
  - **Category**: `unspecified-high` — 端到端验证
  - **Blocks**: 6.2 | **Blocked By**: 5.3
  - **Acceptance**: 完整 test-only 流程成功

- [ ] 6.2 test-and-fix 模式验证
  - **Category**: `unspecified-high` — 端到端验证
  - **Blocks**: 6.3 | **Blocked By**: 6.1
  - **Acceptance**: 完整 test-and-fix 循环成功

- [ ] 6.3 中断恢复验证
  - **Category**: `unspecified-high` — 恢复验证
  - **Blocks**: 完成 | **Blocked By**: 6.2
  - **Acceptance**: 中断后能从 checkpoint 恢复并继续


---

## Final Verification Wave (4 parallel agents, ALL must APPROVE)

- [ ] F1. Plan Compliance Audit — oracle
  - 验证所有任务已实现
  - 验证所有 QA 场景已执行
  - 验证所有产出物已创建

- [ ] F2. Code Quality Review — unspecified-high
  - 代码风格一致性
  - 错误处理完整性
  - 注释和文档质量

- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
  - 手动执行 test-only 模式
  - 手动执行 test-and-fix 模式
  - 手动测试中断恢复

- [ ] F4. Scope Fidelity Check — deep
  - 验证无 scope creep
  - 验证所有 guardrails 生效
  - 验证无未授权功能

## Commit Strategy

**Wave-based Commits**:
- Wave 1: 4 commits（每个任务一个）
- Wave 2: 3 commits（每个任务一个）
- Wave 3: 1 commit（Tester 技能完成）
- Wave 4: 1 commit（Developer 技能完成）
- Wave 5: 1 commit（OpenSpec 集成完成）
- Wave 6: 1 commit（完整验证完成）

**Total**: 11 commits

**Commit Message Format**:
```
feat(web-tester): [description]
feat(web-developer): [description]
chore(playwright): [description]
feat(checkpoint): [description]
feat(opensespec-integration): [description]
test(verification): [description]
```

## Success Criteria

**Functional Success**:
- ✅ Tester Skill 能浏览项目并发现所有主要功能
- ✅ Tester Skill 能生成并执行测试用例
- ✅ Tester Skill 支持中断恢复
- ✅ Developer Skill 能读取测试报告
- ✅ Developer Skill 遵循 TDD 流程（先测试后修复）
- ✅ Developer Skill 支持中断恢复
- ✅ test-only 模式工作正常
- ✅ test-and-fix 模式工作正常（包含验证循环）
- ✅ 知识库持久化工作正常
- ✅ OpenSpec 集成工作正常

**Technical Success**:
- ✅ 0 个严重 bug
- ✅ 0 个数据丢失问题
- ✅ checkpoint 恢复成功率 >95%
- ✅ 测试执行无 flaky（重复运行结果一致）

**User Experience Success**:
- ✅ 技能执行过程中随时可以中断
- ✅ 恢复过程无需人工干预
- ✅ 知识库避免重复 token 消耗
- ✅ 测试报告清晰易读
- ✅ 修复记录完整可追溯

**Metis Guardrails** (from gap analysis):
- ✅ 浏览器安全：不测试生产环境，不使用真实数据
- ✅ 代码修改安全：必须有通过测试，必须用户批准 commit
- ✅ 执行安全：超时限制、重试限制、资源限制
- ✅ OpenSpec 安全：不自动归档，不自动合并

**Scope Boundaries** (explicitly excluded):
- ❌ 视觉回归测试
- ❌ 性能测试
- ❌ 无障碍测试
- ❌ 多浏览器并行
- ❌ WebSocket/实时功能测试
- ❌ 复杂认证流自动化
- ❌ 微服务测试

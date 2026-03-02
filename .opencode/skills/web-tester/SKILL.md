---
name: web-tester
description: Web 测试技能 - 支持两种模式（test-only 和 test-and-fix）的端到端测试工作流。当用户需要为 Web 应用程序创建、运行或修复 E2E 测试时使用。
license: MIT
compatibility: 需要 Node/npm/npx；Playwright 已安装；可选 openspec CLI。
metadata:
  author: user
  version: "1.0"
---

## 技能概述

Web 测试技能提供两种模式的端到端测试工作流：

1. **test-only** - 仅执行测试，报告结果
2. **test-and-fix** - 执行测试，自动修复失败，保存进度

## 核心工作流

### 1. 浏览项目
- 读取 `projects/<projectName>/knowledge/*` 了解项目背景
- 检查是否存在现有测试和配置
- 识别被测试的应用程序结构
- 若提供 `projectDir`，在该目录下扫描与执行测试
- 推荐统一传入 `context`：`{ projectDir, dataDir, cwd }`

### 2. 分解测试任务
- 快速扫描代码库，绘制功能地图
- 将测试分解为原子任务
- 优先覆盖关键路径

### 3. 执行测试
- 按任务顺序执行测试
- 发现新功能时动态添加测试任务
- 记录所有测试结果

### 4. 检查点管理
- **始终首先加载现有检查点**（如果存在）
- 每完成一个任务后保存检查点
- 检查点路径：`projects/<projectName>/sessions/checkpoints/`
- 多项目隔离可通过 `dataDir` 指定独立数据根目录

### 5. 生成报告
- 测试报告路径选项：
  - OpenSpec 变更下：`openspec/changes/<change-name>/test-report.md`
  - 项目会话下：`projects/<projectName>/sessions/test-report.md`

## 两种模式详解

### test-only 模式

**触发场景**：用户仅需要测试结果，不要求修复

**行为**：
- 运行所有测试
- 收集失败信息
- 生成测试报告
- 不修改代码

**输出**：
- 测试报告（包含通过率、失败详情、截图链接）
- 建议的修复列表（不实施）

### test-and-fix 模式

**触发场景**：用户需要测试并自动修复问题

**行为**：
- 运行测试
- 分析失败原因
- 自动修复可自动化的问题（选择器变更、时序问题等）
- 重新运行修复后的测试
- 保存进度到检查点

**输出**：
- 测试报告
- 修复日志
- 检查点状态

## 知识管理

### 读取知识
- 始终首先读取 `projects/<projectName>/knowledge/*`
- 了解项目结构、测试历史、已知问题

### 追加笔记
- 测试完成后追加笔记到知识文件
- **永远不要覆盖**现有内容
- 记录：
  - 新发现的测试模式
  - 修复的陷阱
  - 选择器变更历史

## 测试方法

### 快速扫描
- 识别主要功能区域
- 发现现有测试覆盖范围
- 识别测试空白

### 功能地图
```
┌─────────────────────────────────────────┐
│           功能地图示例                   │
├─────────────────────────────────────────┤
│  用户认证                                │
│  ├─ 登录 ✓                              │
│  ├─ 注册 ✓                              │
│  └─ 密码重置 ✗ (未覆盖)                 │
│                                         │
│  数据管理                                │
│  ├─ 创建 ✓                              │
│  ├─ 读取 ✓                              │
│  ├─ 更新 ✗ (未覆盖)                     │
│  └─ 删除 ✗ (未覆盖)                     │
└─────────────────────────────────────────┘
```

### 任务分解
- 每个功能点 = 独立测试任务
- 动态添加新发现的功能
- 优先级：关键路径 > 边缘情况

## 输出产物

### 测试报告结构
```markdown
# 测试报告

## 概览
- 总测试数：X
- 通过：Y
- 失败：Z
- 跳过：W

## 失败详情
[每个失败的测试]
- 测试名称
- 失败原因
- 截图路径
- 建议修复

## 测试覆盖率
[功能覆盖矩阵]
```

### 检查点结构
```json
{
  "projectName": "...",
  "timestamp": "...",
  "completedTasks": [...],
  "pendingTasks": [...],
  "testResults": {...}
}
```

## 护栏

### 禁止事项
- **不要在未经明确说明的情况下测试生产环境**
- **不要使用真实用户数据**
- 不要删除现有测试
- 不要在未保存检查点的情况下继续

### 安全实践
- 使用测试数据/种子数据
- 在测试前备份状态
- 测试后清理测试数据
- 记录所有变更

## 与现有技能协作

### 使用 Playwright 技能
- 调用 Playwright 技能处理浏览器操作
- 复用现有测试配置

### 使用 OpenSpec 技能
- 当测试发现新需求时，提议创建变更
- 将测试报告链接到相关产出物

### 与 web-developer 协作（test-and-fix 模式）

当模式为 `test-and-fix` 时，web-tester 通过 **Orchestrator** 自动调用 `web-developer` 技能进行修复：

```
┌─────────────────────────────────────────────────────────┐
│                  test-and-fix 工作流                    │
├─────────────────────────────────────────────────────────┤
│  1. web-tester 执行测试                                 │
│     └─> 收集失败案例                                    │
│                                                         │
│  2. Orchestrator 解析失败                               │
│     └─> 转换为修复任务 (PendingFix[])                   │
│     └─> 更新 checkpoint.developer 状态                  │
│                                                         │
│  3. 调用 web-developer 技能                             │
│     └─> TDD 修复循环 (RED → GREEN → REFACTOR)          │
│     └─> 每个 bug 最多 3 次尝试                          │
│                                                         │
│  4. 状态同步                                            │
│     └─> 更新 checkpoint.developer.completedFixes       │
│     └─> 保存修复日志                                    │
│                                                         │
│  5. 验证修复                                            │
│     └─> 重新运行测试确认修复有效                        │
└─────────────────────────────────────────────────────────┘
```

**关键模块**：

| 模块 | 路径 | 职责 |
|------|------|------|
| Orchestrator | `src/orchestrator/index.ts` | 编排 tester → developer 流程 |
| Tester-Bridge | `src/orchestrator/tester-bridge.ts` | 转换失败为修复任务 |
| State-Sync | `src/orchestrator/state-sync.ts` | 同步 checkpoint 状态 |

**调用示例**：

```typescript
import { runTestAndFixFlow } from './src/orchestrator';

// test-and-fix 模式
const result = await runTestAndFixFlow({
  projectName: 'my-web-app',
  mode: 'test-and-fix',
  projectDir: '/path/to/project',
  testFiles: ['tests/e2e/**/*.spec.ts'],
  maxFixAttempts: 3
});

console.log(`Fixed: ${result.fixStats?.fixed}/${result.fixStats?.total}`);
```

---

## 快速开始

```bash
# test-only 模式
使用 web-tester 技能，模式：test-only
项目：<projectName>
项目目录：<projectDir，可选>

# test-and-fix 模式
使用 web-tester 技能，模式：test-and-fix
项目：<projectName>
项目目录：<projectDir，可选>
```

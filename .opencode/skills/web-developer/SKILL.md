---
name: web-developer
description: Web 开发技能 - TDD 驱动的修复工作流（RED->GREEN->REFACTOR），每个 bug 最多 3 次尝试，支持从检查点恢复。当用户需要提供失败的测试报告并自动修复代码时使用。
license: MIT
compatibility: 需要 Node/npm/npx；Playwright 已安装；可选 openspec CLI。
metadata:
  author: user
  version: "1.0"
---

## 技能概述

Web 开发技能提供 TDD 驱动的代码修复工作流，专注于根据失败的测试报告自动修复代码问题。

**核心原则**：
1. 测试优先 - 始终先写/更新测试（RED），再实现修复（GREEN）
2. 迭代限制 - 每个 failing case 最多 3 次尝试，超过则标记为无法修复
3. 检查点恢复 - 始终从现有检查点恢复进度，避免重复工作

## 输入

**必需输入**：
- `projectName` - 项目名称
- `sessionId` 或 `change-name` - 会话 ID 或变更名称
- `testReportPath` - 失败测试报告路径

**可选输入**：
- `knowledgePath` - 知识目录路径（默认：`projects/<projectName>/knowledge/*`）
- `checkpointPath` - 检查点路径（默认：`projects/<projectName>/sessions/checkpoints/`）

## 核心工作流

### 1. 加载上下文

**第一步：读取知识库**
- 读取 `projects/<projectName>/knowledge/*`
- 了解项目结构、技术栈、历史修复记录
- 识别已知问题和注意事项

**第二步：加载检查点**
- 检查是否存在现有检查点
- 如果存在，恢复到最新检查点状态
- 确定已完成的修复和待处理的 failing cases

**第三步：解析测试报告**
- 提取所有 failing cases 列表
- 分析每个失败的原因（选择器、时序、逻辑错误等）
- 按优先级排序修复任务

### 2. TDD 修复循环（每个 failing case）

对每个 failing case 执行以下循环：

```
┌─────────────────────────────────────┐
│         RED->GREEN->REFACTOR        │
├─────────────────────────────────────┤
│  1. RED: 写/更新测试                │
│     - 确保测试能重现失败            │
│     - 验证测试确实失败              │
│                                     │
│  2. GREEN: 实现修复                 │
│     - 最小化代码变更                │
│     - 针对性修复失败原因            │
│                                     │
│  3. 运行验证测试                    │
│     - 如果通过 -> 进入 REFACTOR     │
│     - 如果失败 -> 迭代（最多 3 次）   │
│                                     │
│  4. REFACTOR: 可选重构              │
│     - 清理代码异味                  │
│     - 确保不破坏现有功能            │
└─────────────────────────────────────┘
```

**迭代限制**：
- 每个 failing case 最多 3 次 RED->GREEN 循环
- 3 次后仍未通过 -> 标记为 `unable-to-fix`
- 记录详细失败原因和建议的人工干预方案

### 3. 验证与保存

**运行验证测试**：
- 运行所有相关测试（不仅是修复的 case）
- 确保没有回归问题
- 收集测试覆盖率和性能指标

**保存检查点**：
- 保存修复状态到检查点
- 记录已完成的修复和 pending 任务
- 附加测试报告链接

## 输出产物

**必需输出**：
1. **修复日志** - 路径：`projects/<projectName>/sessions/fix-log.md`
   - 每个 failing case 的修复历史
   - 每次尝试的详细记录
   - 最终状态（fixed/unable-to-fix）

2. **更新知识笔记** - 追加到 `projects/<projectName>/knowledge/`
   - 新发现的修复模式
   - 避免的陷阱
   - 代码变更历史

**禁止输出**：
- **永远不要提交 `storageState` 文件到版本控制**
- 不要自动提交代码变更（除非明确授权）

## 检查点管理

**检查点结构**：
```json
{
  "projectName": "...",
  "sessionId": "...",
  "timestamp": "...",
  "completedFixes": [
    {
      "testCase": "...",
      "status": "fixed|unable-to-fix",
      "attempts": 1-3,
      "changesSummary": "..."
    }
  ],
  "pendingFixes": [...],
  "fixLogPath": "..."
}
```

**恢复行为**：
- 启动时自动检测现有检查点
- 跳过已标记为 `fixed` 的 cases
- 继续处理 `pending` 或 `unable-to-fix` 的 cases
- 从检查点保存的进度继续

## 护栏

### 禁止事项

- **不要自动提交代码** - 所有变更必须由用户明确审查和提交
- **不要在未经明确说明的情况下修改生产环境**
- **不要提交 `storageState` 或包含敏感信息的文件**
- **不要删除或覆盖现有测试**

### 安全实践

- 所有代码变更前备份相关文件
- 记录每次变更的原因和范围
- 验证修复不会引入回归问题
- 保持修复日志的完整性

## 与现有技能协作

### 使用 Playwright 技能
- 调用 Playwright 技能运行浏览器测试
- 复用现有测试配置和工具

### 使用 Session Manager
- 加载和保存检查点状态
- 管理会话历史和进度追踪

### 使用 OpenSpec 技能
- 当修复涉及新需求时，提议创建变更
- 将修复日志链接到相关产出物

---

## 快速开始

```bash
# 基本用法
使用 web-developer 技能
项目：<projectName>
会话/变更：<sessionId 或 change-name>
测试报告：<path/to/test-report.md>

# 从检查点恢复
使用 web-developer 技能
项目：<projectName>
检查点路径：<path/to/checkpoint.json>
```

/**
 * Test-and-Fix Orchestrator
 * 编排 web-tester 和 web-developer 之间的协作
 * 
 * 核心流程：
 * 1. Tester 执行测试，收集失败
 * 2. 解析失败，转换为修复任务
 * 3. 调用 Developer 技能执行修复
 * 4. 同步状态到 checkpoint
 */

import { executeTests, type ExecuteTestsResult } from '../web-tester/execute-tests';
import { parsePlaywrightJsonReport, type FailureCase } from '../web-developer/parse-report';
import { createSession, resumeSession } from '../session-manager';
import { loadCheckpoint, saveCheckpoint } from '../checkpoint';
import { bridgeTesterToDeveloper, type PendingFix, calculateFixStats } from './tester-bridge';
import {
  loadValidatedCheckpoint,
  syncTesterState,
  syncDeveloperState,
  recordTestCompletion,
  recordFixCompletion,
  updateFixProgress,
  getSessionSummary,
  type SessionSummary
} from './state-sync';
import type { CheckpointData, TesterState, DeveloperState } from '../checkpoint-validator';
import type { ExecutionContext } from '../execution-context';

// ============================================================================
// Types
// ============================================================================

/**
 * 编排器选项
 */
export interface OrchestratorOptions {
  /** 项目名称 */
  projectName: string;
  /** 会话 ID（可选，用于恢复） */
  sessionId?: string;
  /** 运行模式 */
  mode: 'test-only' | 'test-and-fix';
  /** 测试文件列表 */
  testFiles: string[];
  /** 目标代码项目目录 */
  projectDir?: string;
  /** 数据隔离根目录 */
  dataDir?: string;
  /** 统一执行上下文 */
  context?: ExecutionContext;
  /** 测试基础 URL */
  baseURL?: string;
  /** 每个修复的最大尝试次数 */
  maxFixAttempts?: number;
  /** 是否在后台运行 */
  runInBackground?: boolean;
}

/**
 * 编排器结果
 */
export interface OrchestratorResult {
  /** 是否成功 */
  ok: boolean;
  /** 会话 ID */
  sessionId: string;
  /** 最终 checkpoint */
  checkpoint: CheckpointData;
  /** 测试结果 */
  testResult: ExecuteTestsResult;
  /** 失败列表 */
  failures: FailureCase[];
  /** 修复统计 */
  fixStats?: {
    total: number;
    fixed: number;
    unableToFix: number;
  };
  /** 错误信息 */
  error?: string;
}

/**
 * 开发者技能调用结果
 */
export interface DeveloperInvokeResult {
  ok: boolean;
  fixedCount: number;
  unableToFixCount: number;
  error?: string;
}

// ============================================================================
// Orchestrator Class
// ============================================================================

/**
 * Test-and-Fix 编排器
 * 
 * 使用示例：
 * ```typescript
 * const orchestrator = new TestAndFixOrchestrator({
 *   projectName: 'my-app',
 *   mode: 'test-and-fix',
 *   testFiles: ['tests/e2e/**/*.spec.ts'],
 *   projectDir: '/path/to/project'
 * });
 * 
 * const result = await orchestrator.run();
 * ```
 */
export class TestAndFixOrchestrator {
  protected options: OrchestratorOptions;
  protected sessionId: string = '';
  protected checkpoint: CheckpointData | null = null;
  protected pendingFixes: PendingFix[] = [];

  constructor(options: OrchestratorOptions) {
    this.options = {
      maxFixAttempts: 3,
      ...options
    };
  }

  /**
   * 运行编排流程
   */
  async run(): Promise<OrchestratorResult> {
    try {
      // 初始化会话
      await this.initializeSession();

      // 运行测试
      console.log('[Orchestrator] Running tests...');
      const testResult = await this.runTests();
      
      // 解析失败
      const failures = await this.parseFailures(testResult);
      
      // 记录测试结果
      await this.recordTestResults(testResult, failures);

      // 构建 base 结果
      const result: OrchestratorResult = {
        ok: testResult.ok || failures.length === 0,
        sessionId: this.sessionId,
        checkpoint: this.checkpoint!,
        testResult,
        failures
      };

      // test-and-fix 模式：调用 developer
      if (this.options.mode === 'test-and-fix' && failures.length > 0) {
        console.log(`[Orchestrator] Found ${failures.length} failures, invoking developer...`);
        
        const developerResult = await this.invokeDeveloper(failures);
        
        result.fixStats = {
          total: failures.length,
          fixed: developerResult.fixedCount,
          unableToFix: developerResult.unableToFixCount
        };

        // 重新运行验证测试
        if (developerResult.fixedCount > 0) {
          console.log('[Orchestrator] Re-running tests for verification...');
          const verifyResult = await this.runTests();
          result.ok = verifyResult.ok;
          result.testResult = verifyResult;
        }
      }

      return result;

    } catch (error) {
      return {
        ok: false,
        sessionId: this.sessionId,
        checkpoint: this.checkpoint!,
        testResult: { ok: false, exitCode: -1, stdout: '', stderr: '' },
        failures: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 初始化或恢复会话
   */
  protected async initializeSession(): Promise<void> {
    // 尝试恢复现有会话
    if (this.options.sessionId) {
      const resume = await resumeSession(this.options.projectName, this.options.sessionId, {
        context: this.options.context
      });

      if (resume && typeof resume === 'object' && 'ok' in resume && resume.ok) {
        this.sessionId = this.options.sessionId;
        this.checkpoint = resume as CheckpointData;
        console.log(`[Orchestrator] Resumed session: ${this.sessionId}`);
        return;
      }
    }

    // 创建新会话
    const newSessionId = await createSession(
      this.options.projectName,
      this.options.mode,
      { context: this.options.context }
    );

    if (!newSessionId) {
      throw new Error('Failed to create session');
    }

    this.sessionId = newSessionId;
    
    // 加载新创建的 checkpoint
    const loaded = await loadCheckpoint(this.options.projectName, this.sessionId, {
      context: this.options.context
    });

    if (!loaded || (typeof loaded === 'object' && 'ok' in loaded && !loaded.ok)) {
      throw new Error('Failed to load checkpoint after session creation');
    }

    this.checkpoint = loaded as CheckpointData;
    console.log(`[Orchestrator] Created session: ${this.sessionId}`);
  }

  /**
   * 运行测试
   */
  protected async runTests(): Promise<ExecuteTestsResult> {
    return executeTests({
      testFiles: this.options.testFiles,
      baseURL: this.options.baseURL,
      context: this.options.context,
      projectDir: this.options.projectDir,
      reporterJsonPath: 'test-results/orchestrator-report.json'
    });
  }

  /**
   * 解析测试失败
   */
  protected async parseFailures(testResult: ExecuteTestsResult): Promise<FailureCase[]> {
    if (!testResult.json) {
      return [];
    }

    const parseResult = parsePlaywrightJsonReport(testResult.json);
    return parseResult.ok ? parseResult.failures : [];
  }

  /**
   * 记录测试结果到 checkpoint
   */
  protected async recordTestResults(
    testResult: ExecuteTestsResult,
    failures: FailureCase[]
  ): Promise<void> {
    if (!this.checkpoint) return;

    const completedTasks: TesterState['completedTasks'] = [];

    // 记录失败的测试
    for (const failure of failures) {
      completedTasks.push({
        taskId: this.generateTaskId(failure),
        status: 'failed',
        testFile: failure.file,
        executedAt: new Date().toISOString(),
        failureDetails: failure.errorMessages.join('\n')
      });
    }

    // 更新 checkpoint
    await syncTesterState({
      projectName: this.options.projectName,
      sessionId: this.sessionId,
      testerState: {
        completedTasks: [
          ...this.checkpoint.tester.completedTasks,
          ...completedTasks
        ]
      },
      context: this.options.context
    });

    // 重新加载 checkpoint
    await this.reloadCheckpoint();
  }

  /**
   * 调用 developer 技能进行修复
   * 
   * 注意：这个方法返回的是调用结果，实际修复由 developer 技能执行
   */
  protected async invokeDeveloper(failures: FailureCase[]): Promise<DeveloperInvokeResult> {
    // 转换失败为修复任务
    const bridgeResult = bridgeTesterToDeveloper({
      testerState: this.checkpoint!.tester,
      failures,
      sessionId: this.sessionId
    });

    this.pendingFixes = bridgeResult.pendingFixes;

    // 更新 developer 初始状态
    await syncDeveloperState({
      projectName: this.options.projectName,
      sessionId: this.sessionId,
      developerState: bridgeResult.updatedDeveloper,
      context: this.options.context
    });

    // 生成调用信息供外部使用
    const invokeInfo = this.generateDeveloperInvokeInfo(failures);

    console.log('[Orchestrator] Developer invoke info generated:');
    console.log(invokeInfo.prompt);

    // 模拟修复流程（实际由外部技能调用）
    // 这里我们返回一个结构化的结果，调用者需要实际触发技能
    return {
      ok: true,
      fixedCount: 0,
      unableToFixCount: failures.length,
      error: 'Developer skill invocation requires external trigger. Use the generated invoke info.'
    };
  }

  /**
   * 生成 developer 技能调用信息
   * 这个方法生成一个结构化的调用提示，供外部工具使用
   */
  generateDeveloperInvokeInfo(failures: FailureCase[]): {
    skill: string;
    prompt: string;
    context: {
      projectName: string;
      sessionId: string;
      projectDir?: string;
      maxAttempts: number;
    };
  } {
    const context = {
      projectName: this.options.projectName,
      sessionId: this.sessionId,
      projectDir: this.options.projectDir,
      maxAttempts: this.options.maxFixAttempts || 3
    };

    const prompt = this.buildDeveloperPrompt(failures);

    return {
      skill: 'web-developer',
      prompt,
      context
    };
  }

  /**
   * 构建 developer 调用提示
   */
  protected buildDeveloperPrompt(failures: FailureCase[]): string {
    const maxAttempts = this.options.maxFixAttempts || 3;

    return `
# 调用 web-developer 技能

## 上下文
- **项目名称**: ${this.options.projectName}
- **会话 ID**: ${this.sessionId}
- **项目目录**: ${this.options.projectDir || '当前目录'}
- **最大尝试次数**: ${maxAttempts}

## 待修复的失败案例

${failures.map((f, i) => `### ${i + 1}. ${f.title}
- **文件**: ${f.file}
- **行号**: ${f.line ?? 'N/A'}
- **状态**: ${f.status}
- **错误信息**:
\`\`\`
${f.errorMessages.join('\n')}
\`\`\`
`).join('\n')}

## 预期行为

1. 解析每个失败案例的根本原因
2. 使用 TDD 循环修复 (RED → GREEN → REFACTOR)
3. 每个失败最多尝试 ${maxAttempts} 次
4. 更新 checkpoint 中的 developer 状态
5. 保存修复日志

## 重要提示

- 所有修复在 projectDir 下执行
- 保持 checkpoint 状态同步
- 记录每个修复的详细信息
    `.trim();
  }

  /**
   * 重新加载 checkpoint
   */
  protected async reloadCheckpoint(): Promise<void> {
    const loaded = await loadValidatedCheckpoint(
      this.options.projectName,
      this.sessionId,
      this.options.context
    );

    if (loaded) {
      this.checkpoint = loaded;
    }
  }

  /**
   * 生成任务 ID
   */
  protected generateTaskId(failure: FailureCase): string {
    const fileBase = failure.file.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'unknown';
    const titleSlug = failure.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${fileBase}-${titleSlug}`;
  }

  /**
   * 获取会话摘要
   */
  async getSummary(): Promise<SessionSummary | null> {
    return getSessionSummary(
      this.options.projectName,
      this.sessionId,
      this.options.context
    );
  }

  /**
   * 获取当前 checkpoint
   */
  getCheckpoint(): CheckpointData | null {
    return this.checkpoint;
  }

  /**
   * 获取待修复列表
   */
  getPendingFixes(): PendingFix[] {
    return this.pendingFixes;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 运行 test-and-fix 流程
 * 
 * @example
 * ```typescript
 * const result = await runTestAndFixFlow({
 *   projectName: 'my-app',
 *   mode: 'test-and-fix',
 *   testFiles: ['tests/**/*.spec.ts'],
 *   projectDir: '/path/to/project'
 * });
 * ```
 */
export async function runTestAndFixFlow(
  options: OrchestratorOptions
): Promise<OrchestratorResult> {
  const orchestrator = new TestAndFixOrchestrator(options);
  return orchestrator.run();
}

/**
 * 仅运行测试（test-only 模式）
 */
export async function runTestOnlyFlow(
  options: Omit<OrchestratorOptions, 'mode'>
): Promise<OrchestratorResult> {
  const orchestrator = new TestAndFixOrchestrator({
    ...options,
    mode: 'test-only'
  });
  return orchestrator.run();
}

/**
 * 获取 developer 调用信息
 * 用于在外部触发 developer 技能
 */
export async function prepareDeveloperInvocation(
  options: OrchestratorOptions
): Promise<{
  invokeInfo: ReturnType<TestAndFixOrchestrator['generateDeveloperInvokeInfo']>;
  sessionId: string;
  failures: FailureCase[];
} | null> {
  const orchestrator = new TestAndFixOrchestrator(options);
  
  // 初始化会话
  await (orchestrator as any).initializeSession();
  
  // 运行测试
  const testResult = await (orchestrator as any).runTests();
  const failures = await (orchestrator as any).parseFailures(testResult);
  
  if (failures.length === 0) {
    return null;
  }

  const invokeInfo = orchestrator.generateDeveloperInvokeInfo(failures);

  return {
    invokeInfo,
    sessionId: (orchestrator as any).sessionId,
    failures
  };
}

// Re-export types
export type {
  FailureCase,
  PendingFix,
  CheckpointData,
  TesterState,
  DeveloperState
};
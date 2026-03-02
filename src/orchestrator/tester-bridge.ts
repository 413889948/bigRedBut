/**
 * Tester-Developer Bridge
 * 将 web-tester 的失败信息转换为 web-developer 可处理的修复任务
 */

import type { FailureCase } from '../web-developer/parse-report';
import type { TesterState, DeveloperState } from '../checkpoint-validator';

/**
 * 从 tester 失败信息构建的修复任务
 */
export interface PendingFix {
  bugId: string;
  testFile: string;
  title: string;
  line?: number;
  column?: number;
  status: string;
  errorMessages: string[];
  attempts: number;
}

/**
 * Bridge 输入
 */
export interface BridgeInput {
  testerState: TesterState;
  failures: FailureCase[];
  sessionId: string;
}

/**
 * Bridge 输出
 */
export interface BridgeOutput {
  pendingFixes: PendingFix[];
  updatedDeveloper: Partial<DeveloperState>;
}

/**
 * 将 tester 的失败案例转换为 developer 的修复队列
 * 
 * @param input - 包含 tester 状态、失败列表和会话 ID
 * @returns 待修复队列和更新后的 developer 状态
 */
export function bridgeTesterToDeveloper(input: BridgeInput): BridgeOutput {
  const { testerState, failures, sessionId } = input;

  // 构建修复队列，每个失败对应一个修复任务
  const pendingFixes: PendingFix[] = failures.map((failure, idx) => ({
    bugId: `${sessionId}-bug-${idx + 1}`,
    testFile: failure.file,
    title: failure.title,
    line: failure.line,
    column: failure.column,
    status: failure.status,
    errorMessages: failure.errorMessages,
    attempts: 0
  }));

  // 构建初始 developer 状态
  const updatedDeveloper: Partial<DeveloperState> = {
    completedFixes: [],
    currentFix: pendingFixes.length > 0 ? {
      bugId: pendingFixes[0].bugId,
      status: 'analyzing',
      attempts: 0,
      testFile: pendingFixes[0].testFile
    } : undefined
  };

  return {
    pendingFixes,
    updatedDeveloper
  };
}

/**
 * 从修复结果更新 developer 状态
 */
export interface UpdateDeveloperInput {
  developerState: DeveloperState;
  fixResult: {
    bugId: string;
    status: 'fixed' | 'unable-to-fix' | 'deferred';
    testFile?: string;
    fixedFiles?: string[];
    attempts: number;
  };
}

export function updateDeveloperFromFix(input: UpdateDeveloperInput): DeveloperState {
  const { developerState, fixResult } = input;

  const completedFix = {
    bugId: fixResult.bugId,
    status: fixResult.status,
    testFile: fixResult.testFile,
    fixedFiles: fixResult.fixedFiles,
    attempts: fixResult.attempts,
    completedAt: new Date().toISOString()
  };

  return {
    ...developerState,
    completedFixes: [...developerState.completedFixes, completedFix],
    currentFix: undefined
  };
}

/**
 * 获取下一个待修复的任务
 */
export function getNextPendingFix(
  pendingFixes: PendingFix[],
  completedBugIds: string[]
): PendingFix | undefined {
  return pendingFixes.find(fix => !completedBugIds.includes(fix.bugId));
}

/**
 * 统计修复结果
 */
export interface FixStats {
  total: number;
  fixed: number;
  unableToFix: number;
  deferred: number;
}

export function calculateFixStats(completedFixes: DeveloperState['completedFixes']): FixStats {
  const stats: FixStats = {
    total: completedFixes.length,
    fixed: 0,
    unableToFix: 0,
    deferred: 0
  };

  for (const fix of completedFixes) {
    if (fix.status === 'fixed') stats.fixed++;
    else if (fix.status === 'unable-to-fix') stats.unableToFix++;
    else if (fix.status === 'deferred') stats.deferred++;
  }

  return stats;
}
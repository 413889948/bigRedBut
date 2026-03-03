import type { FailureCase } from '../../../web-developer/src/parse-report';
import type { TesterState, DeveloperState } from '../../../_skill-core/src/checkpoint-validator';

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

export interface BridgeInput {
  testerState: TesterState;
  failures: FailureCase[];
  sessionId: string;
}

export interface BridgeOutput {
  pendingFixes: PendingFix[];
  updatedDeveloper: Partial<DeveloperState>;
}

export function bridgeTesterToDeveloper(input: BridgeInput): BridgeOutput {
  const { failures, sessionId } = input;

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

export function getNextPendingFix(
  pendingFixes: PendingFix[],
  completedBugIds: string[]
): PendingFix | undefined {
  return pendingFixes.find(fix => !completedBugIds.includes(fix.bugId));
}

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

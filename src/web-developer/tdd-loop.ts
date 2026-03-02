import type { FailureCase } from './parse-report';

export type TddPhase = 'write-test' | 'apply-fix' | 'verify';

export interface TddAttemptLog {
  failure: FailureCase;
  attempt: number;
  phase: TddPhase;
  ok: boolean;
  message: string;
  changedFiles?: string[];
}

export interface ApplyFixResult {
  ok: boolean;
  message: string;
  changedFiles?: string[];
  fatal?: boolean;
}

export interface VerifyResult {
  ok: boolean;
  message: string;
}

export interface TddLoopResult {
  fixed: FailureCase[];
  unableToFix: FailureCase[];
  logs: TddAttemptLog[];
}

export interface RunTddLoopInput {
  failures: FailureCase[];
  maxAttempts?: number;
  applyFix: (input: {
    failure: FailureCase;
    attempt: number;
    maxAttempts: number;
  }) => ApplyFixResult | Promise<ApplyFixResult>;
  verify: (input: {
    failure: FailureCase;
    attempt: number;
    maxAttempts: number;
    changedFiles?: string[];
  }) => VerifyResult | Promise<VerifyResult>;
}

function normalizeMaxAttempts(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 3;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : 3;
}

export async function runTddLoop({
  failures,
  maxAttempts,
  applyFix,
  verify,
}: RunTddLoopInput): Promise<TddLoopResult> {
  const limit = normalizeMaxAttempts(maxAttempts);
  const fixed: FailureCase[] = [];
  const unableToFix: FailureCase[] = [];
  const logs: TddAttemptLog[] = [];

  for (const failure of failures) {
    let resolved = false;

    for (let attempt = 1; attempt <= limit; attempt += 1) {
      logs.push({
        failure,
        attempt,
        phase: 'write-test',
        ok: true,
        message: 'Write test step recorded',
      });

      const fixResult = await applyFix({ failure, attempt, maxAttempts: limit });
      logs.push({
        failure,
        attempt,
        phase: 'apply-fix',
        ok: fixResult.ok,
        message: fixResult.message,
        changedFiles: fixResult.changedFiles,
      });

      if (!fixResult.ok && fixResult.fatal) {
        unableToFix.push(failure);
        resolved = true;
        break;
      }

      const verifyResult = await verify({
        failure,
        attempt,
        maxAttempts: limit,
        changedFiles: fixResult.changedFiles,
      });
      logs.push({
        failure,
        attempt,
        phase: 'verify',
        ok: verifyResult.ok,
        message: verifyResult.message,
        changedFiles: fixResult.changedFiles,
      });

      if (verifyResult.ok) {
        fixed.push(failure);
        resolved = true;
        break;
      }
    }

    if (!resolved) {
      unableToFix.push(failure);
    }
  }

  return {
    fixed,
    unableToFix,
    logs,
  };
}

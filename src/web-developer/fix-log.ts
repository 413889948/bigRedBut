import { appendFile, mkdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import {
  resolveDataDir,
  withExecutionContext,
  type ExecutionContext,
} from '../execution-context';
import type { TddAttemptLog } from './tdd-loop';
import type { FailureCase } from './parse-report';

export interface RecordFixLogInput {
  /** Project name for log file path */
  projectName: string;
  /** TDD logs to record */
  tddLogs: TddAttemptLog[];
  /** Original failures that were addressed */
  failures: FailureCase[];
  /** Additional context or summary */
  summary?: string;
  /** Data root for session/fix-log storage. Defaults to <cwd>/projects */
  dataDir?: string;
  /** Unified execution context */
  context?: ExecutionContext;
}

export interface RecordFixLogResult {
  /** Path to the fix log file */
  logPath: string;
  /** Whether this was a new file or append to existing */
  isNewFile: boolean;
}

const SESSIONS_DIR = 'sessions';

interface FixLogPathOptions {
  dataDir?: string;
  context?: ExecutionContext;
}

function resolveDataRoot(options?: FixLogPathOptions): string {
  const context = withExecutionContext(options?.context, {
    dataDir: options?.dataDir ?? options?.context?.dataDir,
  });
  return resolveDataDir(context);
}

function getFixLogPath(projectName: string, options?: FixLogPathOptions): string {
  return path.join(resolveDataRoot(options), projectName, SESSIONS_DIR, 'fix-log.md');
}

function toDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toTimeStammp(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Records TDD fix logs to a project's fix-log.md file.
 * Follows append-only convention with date/time-stamped sections.
 * The fix log file is written by code at runtime and should not be prefilled.
 */
export async function recordFixLog(input: RecordFixLogInput): Promise<RecordFixLogResult> {
  const { projectName, tddLogs, failures, summary, dataDir, context } = input;
  const logPath = getFixLogPath(projectName, { dataDir, context });
  const logDir = path.dirname(logPath);

  await mkdir(logDir, { recursive: true });

  // Check if file exists
  let isNewFile = false;
  try {
    await readFile(logPath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      isNewFile = true;
    } else {
      throw error;
    }
  }

  // Build the log entry
  const entry = buildLogEntry(tddLogs, failures, summary);

  // Append to file
  const prefix = isNewFile ? '' : entry.startsWith('\n') ? '' : '\n\n';
  await appendFile(logPath, `${prefix}${entry}`, 'utf8');

  return {
    logPath,
    isNewFile,
  };
}

function buildLogEntry(
  tddLogs: TddAttemptLog[],
  failures: FailureCase[],
  summary?: string
): string {
  const timestamp = toTimeStammp(new Date());
  const dateStamp = toDateStamp(new Date());

  const lines: string[] = [
    `## ${dateStamp} ${timestamp}`,
    '',
  ];

  // Add summary if provided
  if (summary) {
    lines.push(`### Summary`, summary, '');
  }

  // Add failures overview
  lines.push(`### Failures Addressed (${failures.length})`, '');
  for (const failure of failures) {
    const filePart = failure.file ? ` (${normalizePath(failure.file)})` : '';
    lines.push(`- **${failure.title || 'Unknown'}**${filePart}`);
    if (failure.errorMessages && failure.errorMessages.length > 0) {
      lines.push(`  - Error: ${failure.errorMessages[0]}`);
    }
  }
  lines.push('');

  // Add TDD loop details
  lines.push(`### TDD Loop Details (${tddLogs.length} steps)`, '');

  // Group logs by failure
  const failureGroups = new Map<FailureCase, TddAttemptLog[]>();
  for (const log of tddLogs) {
    const existing = failureGroups.get(log.failure) || [];
    existing.push(log);
    failureGroups.set(log.failure, existing);
  }

  for (const [failure, logs] of failureGroups) {
    const titlePart = failure.title || 'Unknown test';
    const filePart = failure.file ? ` in ${normalizePath(failure.file)}` : '';

    lines.push(`#### ${titlePart}${filePart}`, '');

    for (const log of logs) {
      const statusIcon = log.ok ? '[OK]' : '[FAIL]';
      lines.push(
        `- ${statusIcon} Attempt #${log.attempt} [${log.phase}]: ${log.message}`
      );

      if (log.changedFiles && log.changedFiles.length > 0) {
        const normalizedFiles = log.changedFiles.map((f) => normalizePath(f));
        lines.push(`  - Changed files: ${normalizedFiles.join(', ')}`);
      }
    }
    lines.push('');
  }

  // Add statistics
  const totalAttempts = tddLogs.length;
  const successfulAttempts = tddLogs.filter((log) => log.ok).length;
  const failedAttempts = totalAttempts - successfulAttempts;

  lines.push(`### Statistics`, '');
  lines.push(`- Total attempts: ${totalAttempts}`);
  lines.push(`- Successful: ${successfulAttempts}`);
  lines.push(`- Failed: ${failedAttempts}`);
  const successRate = totalAttempts > 0
    ? Math.round((successfulAttempts / totalAttempts) * 100)
    : 0;
  lines.push(`- Success rate: ${successRate}%`);
  lines.push('');

  // Add separator for next entry
  lines.push(`---`, '');

  return lines.join('\n');
}

function normalizePath(filePath: string): string {
  // Normalize to forward slashes for cross-platform compatibility
  return filePath.split(path.sep).join('/');
}

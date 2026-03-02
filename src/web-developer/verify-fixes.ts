import { spawn } from 'node:child_process';
import * as path from 'node:path';
import type { FailureCase } from './parse-report';

export interface VerifyFixesInput {
  /** Path to Playwright report JSON file from previous run */
  reportPath?: string;
  /** Specific test files to run (absolute or relative paths) */
  testFiles?: string[];
  /** Project name for knowledge file paths */
  projectName?: string;
  /** Working directory for running tests */
  cwd?: string;
}

export interface VerifyFixesResult {
  ok: boolean;
  message: string;
  /** Failures that still persist after verification */
  remainingFailures: FailureCase[];
  /** Path to the generated report file */
  reportPath?: string;
}

/**
 * Runs Playwright tests to verify fixes.
 * Uses serial execution and targets either:
 * - The spec files containing previous failures, or
 * - A provided list of test files
 */
export async function verifyFixes(input: VerifyFixesInput): Promise<VerifyFixesResult> {
  const cwd = input.cwd ?? process.cwd();
  const reportDir = path.join(cwd, 'playwright-report');
  const reportPath = input.reportPath ?? path.join(reportDir, 'report.json');

  // Build command arguments
  const args: string[] = ['playwright', 'test'];

  // Add test files if provided, otherwise extract from report
  if (input.testFiles && input.testFiles.length > 0) {
    const normalizedFiles = input.testFiles.map((f) => normalizePath(f, cwd));
    args.push(...normalizedFiles);
  } else if (input.reportPath) {
    // Try to extract failing test files from previous report
    const filesFromReport = await extractFailingTestFiles(input.reportPath);
    if (filesFromReport.length > 0) {
      args.push(...filesFromReport);
    }
  }

  // Always run in serial mode for verification
  args.push('--reporter=json', '--workers=1');

  // Output report to specific path
  args.push(`--output=${path.join(cwd, 'test-results')}`);

  return new Promise((resolve) => {
    const child = spawn('npx', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', async (code) => {
      const success = code === 0;

      // Try to parse the report for remaining failures
      let remainingFailures: FailureCase[] = [];
      try {
        const reportContent = await readJsonFile(reportPath);
        if (reportContent) {
          const parseResult = await import('./parse-report').then((m) => m.parsePlaywrightJsonReport(reportContent));
          if (parseResult.ok) {
            remainingFailures = parseResult.failures;
          }
        }
      } catch {
        // Ignore report parsing errors
      }

      resolve({
        ok: success && remainingFailures.length === 0,
        message: success
          ? 'All verification tests passed'
          : remainingFailures.length > 0
            ? `Verification found ${remainingFailures.length} remaining failure(s)`
            : `Tests exited with code ${code}`,
        remainingFailures,
        reportPath,
      });
    });

    child.on('error', (err) => {
      resolve({
        ok: false,
        message: `Failed to spawn test process: ${err.message}`,
        remainingFailures: [],
        reportPath,
      });
    });
  });
}

/**
 * Extracts unique test file paths from a Playwright JSON report
 */
async function extractFailingTestFiles(reportPath: string): Promise<string[]> {
  try {
    const content = await readJsonFile(reportPath);
    if (!content) {
      return [];
    }

    const parseResult = await import('./parse-report').then((m) => m.parsePlaywrightJsonReport(content));
    if (!parseResult.ok) {
      return [];
    }

    // Extract unique file paths from failures
    const fileSet = new Set<string>();
    for (const failure of parseResult.failures) {
      if (failure.file) {
        fileSet.add(failure.file);
      }
    }

    return Array.from(fileSet);
  } catch {
    return [];
  }
}

function normalizePath(filePath: string, cwd: string): string {
  // Normalize to forward slashes for cross-platform compatibility
  const normalized = filePath.split(path.sep).join('/');

  // If already absolute, return as-is
  if (path.isAbsolute(filePath)) {
    return normalized;
  }

  // Make relative to cwd
  const resolved = path.resolve(cwd, filePath);
  const relative = path.relative(cwd, resolved);
  return relative.split(path.sep).join('/');
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

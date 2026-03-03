import { spawn } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import * as path from 'node:path';
import {
  resolveProjectDir,
  withExecutionContext,
  type ExecutionContext,
} from '../../_skill-core/src/execution-context';
import type { FailureCase } from './parse-report';

export interface VerifyFixesInput {
  reportPath?: string;
  testFiles?: string[];
  projectName?: string;
  context?: ExecutionContext;
  cwd?: string;
  projectDir?: string;
}

export interface VerifyFixesResult {
  ok: boolean;
  message: string;
  remainingFailures: FailureCase[];
  reportPath?: string;
}

export async function verifyFixes(input: VerifyFixesInput): Promise<VerifyFixesResult> {
  const context = withExecutionContext(input.context, {
    projectDir: input.projectDir ?? input.context?.projectDir,
    cwd: input.cwd ?? input.context?.cwd,
  });
  const cwd = resolveProjectDir(context);
  const reportDir = path.join(cwd, 'playwright-report');
  const rawReportPath = input.reportPath ?? path.join(reportDir, 'report.json');
  const reportPath = path.isAbsolute(rawReportPath)
    ? rawReportPath
    : path.resolve(cwd, rawReportPath);
  await mkdir(path.dirname(reportPath), { recursive: true });
  try {
    await unlink(reportPath);
  } catch {
    // no-op
  }

  const args: string[] = ['playwright', 'test'];

  if (input.testFiles && input.testFiles.length > 0) {
    const normalizedFiles = input.testFiles.map((f) => normalizePath(f, cwd));
    args.push(...normalizedFiles);
  } else if (input.reportPath) {
    const filesFromReport = await extractFailingTestFiles(reportPath);
    if (filesFromReport.length > 0) {
      args.push(...filesFromReport);
    }
  }

  args.push('--reporter=json', '--workers=1');
  args.push(`--output=${path.join(cwd, 'test-results')}`);

  return new Promise((resolve) => {
    const child = spawn('npx', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath },
      shell: process.platform === 'win32',
    });

    child.on('close', async (code) => {
      const success = code === 0;

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
        // Ignore
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
  const normalized = filePath.split(path.sep).join('/');

  if (path.isAbsolute(filePath)) {
    return normalized;
  }

  const resolved = path.resolve(cwd, filePath);
  const relative = path.relative(cwd, resolved);
  return relative.split(path.sep).join('/');
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

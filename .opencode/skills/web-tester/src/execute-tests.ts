import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import {
  resolveProjectDir,
  withExecutionContext,
  type ExecutionContext,
} from '../../_skill-core/src/execution-context';

export interface ExecuteTestsOptions {
  testFiles: string[];
  baseURL?: string;
  reporterJsonPath?: string;
  timeoutMs?: number;
  /** Unified execution context */
  context?: ExecutionContext;
  /** Working directory to run Playwright in */
  cwd?: string;
  /** Alias of cwd for external project directory */
  projectDir?: string;
}

export interface ExecuteTestsResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  json?: unknown;
}

export async function executeTests(options: ExecuteTestsOptions): Promise<ExecuteTestsResult> {
  const { testFiles, baseURL, reporterJsonPath, timeoutMs } = options;
  const context = withExecutionContext(options.context, {
    projectDir: options.projectDir ?? options.context?.projectDir,
    cwd: options.cwd ?? options.context?.cwd,
  });
  const workingDir = resolveProjectDir(context);
  const resolvedReportPath =
    typeof reporterJsonPath === 'string' && reporterJsonPath.length > 0
      ? (path.isAbsolute(reporterJsonPath)
          ? reporterJsonPath
          : path.resolve(workingDir, reporterJsonPath))
      : undefined;
  if (resolvedReportPath) {
    await mkdir(path.dirname(resolvedReportPath), { recursive: true });
  }

  const args = ['playwright', 'test', '--workers=1'];
  if (reporterJsonPath) {
    args.push('--reporter=json');
  }
  args.push(...testFiles);

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (baseURL) {
    env.PLAYWRIGHT_TEST_BASE_URL = baseURL;
  }
  if (resolvedReportPath) {
    env.PLAYWRIGHT_JSON_OUTPUT_FILE = resolvedReportPath;
  }

  const runResult = await new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn('npx', args, {
      cwd: workingDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });

    let stdout = '';
    let stderr = '';
    let didTimeout = false;

    const timeoutHandle =
      typeof timeoutMs === 'number' && timeoutMs > 0
        ? setTimeout(() => {
            didTimeout = true;
            child.kill();
          }, timeoutMs)
        : undefined;

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      resolve({
        exitCode: null,
        stdout,
        stderr: `${stderr}\nFailed to start Playwright process: ${error.message}`.trim()
      });
    });

    child.on('close', (exitCode) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      if (didTimeout) {
        stderr = `${stderr}\nPlaywright process timed out after ${timeoutMs}ms.`.trim();
      }

      resolve({ exitCode, stdout, stderr });
    });
  });

  let json: unknown;
  if (resolvedReportPath) {
    try {
      const rawJson = await readFile(resolvedReportPath, 'utf8');
      json = JSON.parse(rawJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runResult.stderr = `${runResult.stderr}\nFailed to read JSON reporter output: ${message}`.trim();
    }
  }

  return {
    ok: runResult.exitCode === 0,
    exitCode: runResult.exitCode,
    stdout: runResult.stdout,
    stderr: runResult.stderr,
    ...(typeof json === 'undefined' ? {} : { json })
  };
}

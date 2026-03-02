import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

export interface ExecuteTestsOptions {
  testFiles: string[];
  baseURL?: string;
  reporterJsonPath?: string;
  timeoutMs?: number;
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

  const args = ['playwright', 'test', '--workers=1'];
  if (reporterJsonPath) {
    args.push('--reporter=json');
  }
  args.push(...testFiles);

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (baseURL) {
    env.PLAYWRIGHT_TEST_BASE_URL = baseURL;
  }
  if (reporterJsonPath) {
    env.PLAYWRIGHT_JSON_OUTPUT_FILE = reporterJsonPath;
  }

  const runResult = await new Promise<{ exitCode: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn('npx', args, {
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
  if (reporterJsonPath) {
    try {
      const rawJson = await readFile(reporterJsonPath, 'utf8');
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

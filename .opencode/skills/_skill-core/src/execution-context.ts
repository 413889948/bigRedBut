import * as path from 'node:path';

export interface ExecutionContext {
  /** Root directory of the target code project */
  projectDir?: string;
  /** Optional alias for working directory */
  cwd?: string;
  /** Root directory for persisted data (sessions/checkpoints/knowledge) */
  dataDir?: string;
}

const ENV_PROJECT_DIR_KEYS = ['EXECUTION_PROJECT_DIR', 'PROJECT_DIR'];
const ENV_DATA_DIR_KEYS = ['EXECUTION_DATA_DIR', 'DATA_DIR'];

function readEnvPath(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function toAbsolutePath(candidate: string, baseDir: string): string {
  return path.isAbsolute(candidate) ? candidate : path.resolve(baseDir, candidate);
}

export function resolveProjectDir(context?: ExecutionContext): string {
  const raw = context?.projectDir ?? context?.cwd ?? readEnvPath(ENV_PROJECT_DIR_KEYS) ?? process.cwd();
  return toAbsolutePath(raw, process.cwd());
}

export function resolveDataDir(context?: ExecutionContext): string {
  const raw =
    (typeof context?.dataDir === 'string' && context.dataDir.length > 0
      ? context.dataDir
      : undefined) ?? readEnvPath(ENV_DATA_DIR_KEYS);

  if (raw) {
    return toAbsolutePath(raw, resolveProjectDir(context));
  }

  return path.join(process.cwd(), 'projects');
}

export function withExecutionContext(
  context: ExecutionContext | undefined,
  overrides?: Partial<ExecutionContext>,
): ExecutionContext {
  return {
    ...(context ?? {}),
    ...(overrides ?? {}),
  };
}

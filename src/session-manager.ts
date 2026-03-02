import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  resolveDataDir,
  withExecutionContext,
  type ExecutionContext,
} from './execution-context';
import {
  saveCheckpoint,
  loadCheckpoint,
  type LoadCheckpointResult,
  type CheckpointPathOptions,
} from './checkpoint';

export interface SessionPathOptions extends CheckpointPathOptions {
  /** Unified execution context */
  context?: ExecutionContext;
}

function resolveDataRoot(options?: SessionPathOptions): string {
  const context = withExecutionContext(options?.context, {
    dataDir: options?.dataDir ?? options?.context?.dataDir,
  });
  return resolveDataDir(context);
}

/**
 * Generate a deterministic session ID using timestamp and random suffix
 */
function generateSessionId(): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `session-${timestamp}-${randomSuffix}`;
}

/**
 * Get the session log file path
 */
function getLogPath(projectName: string, sessionId: string, options?: SessionPathOptions): string {
  return path.join(resolveDataRoot(options), projectName, 'sessions', `${sessionId}.log`);
}

/**
 * Get the sessions directory path
 */
function getSessionsDir(projectName: string, options?: SessionPathOptions): string {
  return path.join(resolveDataRoot(options), projectName, 'sessions');
}

/**
 * Get the checkpoints directory path
 */
function getCheckpointsDir(projectName: string, options?: SessionPathOptions): string {
  return path.join(resolveDataRoot(options), projectName, 'sessions', 'checkpoints');
}

/**
 * Append a log entry to the session log file
 */
async function appendLog(
  projectName: string,
  sessionId: string,
  operation: string,
  details?: string,
  options?: SessionPathOptions
): Promise<void> {
  const logPath = getLogPath(projectName, sessionId, options);
  const dirPath = path.dirname(logPath);

  // Ensure directory exists
  await fs.promises.mkdir(dirPath, { recursive: true });

  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${operation}${details ? `: ${details}` : ''}\n`;

  await fs.promises.appendFile(logPath, logEntry, 'utf8');
}

/**
 * Read all log entries from a session log file
 */
async function readLog(projectName: string, sessionId: string, options?: SessionPathOptions): Promise<string[]> {
  const logPath = getLogPath(projectName, sessionId, options);

  try {
    await fs.promises.access(logPath);
  } catch {
    return [];
  }

  const content = await fs.promises.readFile(logPath, 'utf8');
  return content.split('\n').filter((line) => line.trim() !== '');
}

/**
 * Create a new session with initial checkpoint
 * @param projectName - Name of the project
 * @param mode - Operating mode: 'test-only' or 'test-and-fix'
 * @returns The created session ID, or null on failure
 */
export async function createSession(
  projectName: string,
  mode: 'test-only' | 'test-and-fix',
  options?: SessionPathOptions
): Promise<string | null> {
  try {
    const sessionId = generateSessionId();
    const timestamp = new Date().toISOString();

    // Create initial checkpoint data matching schema
    const initialData = {
      version: '1.0.0',
      sessionId,
      mode,
      lastUpdated: timestamp,
      tester: {
        completedTasks: [],
        storageStatePath: 'playwright/.auth/user.json'
      },
      developer: {
        completedFixes: []
      },
      knowledge: {
        techStack: [],
        gotchas: [],
        testNotes: []
      }
    };

    // Save initial checkpoint
    const saved = await saveCheckpoint(projectName, sessionId, initialData, options);
    if (!saved) {
      return null;
    }

    // Log the creation
    await appendLog(
      projectName,
      sessionId,
      'CREATE',
      `mode=${mode}, version=1.0.0`,
      options
    );

    return sessionId;
  } catch (error) {
    console.error(`Failed to create session for ${projectName}:`, error);
    return null;
  }
}

/**
 * Resume an existing session by loading its checkpoint
 * @param projectName - Name of the project
 * @param sessionId - Session ID to resume
 * @returns Validated checkpoint data if found, null if not found, or structured error (never throws)
 */
export async function resumeSession(
  projectName: string,
  sessionId: string,
  options?: SessionPathOptions
): Promise<LoadCheckpointResult> {
  try {
    const data = await loadCheckpoint(projectName, sessionId, options);

    if (data !== null && typeof data === 'object' && 'ok' in data && !data.ok) {
      // Validation or parse error - log and return
      await appendLog(projectName, sessionId, 'RESUME_FAILED', `errorType=${data.errorType}`, options);
      return data;
    }

    if (data !== null) {
      await appendLog(projectName, sessionId, 'RESUME', undefined, options);
    }

    return data;
  } catch (error) {
    console.error(`Failed to resume session ${projectName}/${sessionId}:`, error);
    return null;
  }
}

/**
 * Close a session by saving final checkpoint data
 * @param projectName - Name of the project
 * @param sessionId - Session ID to close
 * @param finalData - Final checkpoint data to save
 * @returns true on success, false on failure
 */
export async function closeSession(
  projectName: string,
  sessionId: string,
  finalData: unknown,
  options?: SessionPathOptions
): Promise<boolean> {
  try {
    // Update lastUpdated timestamp
    const dataWithTimestamp =
      typeof finalData === 'object' && finalData !== null
        ? { ...finalData, lastUpdated: new Date().toISOString() }
        : finalData;

    const saved = await saveCheckpoint(projectName, sessionId, dataWithTimestamp, options);

    if (saved) {
      await appendLog(projectName, sessionId, 'CLOSE', 'final checkpoint saved', options);
    }

    return saved;
  } catch (error) {
    console.error(`Failed to close session ${projectName}/${sessionId}:`, error);
    return false;
  }
}

/**
 * List all known session IDs for a project
 * @param projectName - Name of the project
 * @returns Array of session IDs
 */
export async function listSessions(projectName: string, options?: SessionPathOptions): Promise<string[]> {
  try {
    const checkpointsDir = getCheckpointsDir(projectName, options);

    // Check if directory exists
    try {
      await fs.promises.access(checkpointsDir);
    } catch {
      return [];
    }

    // Read directory and filter for .json files (checkpoints)
    const entries = await fs.promises.readdir(checkpointsDir, { withFileTypes: true });

    const sessionIds = entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith('.json') &&
          !entry.name.startsWith('.')
      )
      .map((entry) => entry.name.replace('.json', ''));

    return sessionIds;
  } catch (error) {
    console.error(`Failed to list sessions for ${projectName}:`, error);
    return [];
  }
}

/**
 * Get the log entries for a specific session
 * @param projectName - Name of the project
 * @param sessionId - Session ID
 * @returns Array of log entries
 */
export async function getSessionLog(
  projectName: string,
  sessionId: string,
  options?: SessionPathOptions
): Promise<string[]> {
  return readLog(projectName, sessionId, options);
}

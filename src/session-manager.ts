import * as fs from 'node:fs';
import * as path from 'node:path';
import { saveCheckpoint, loadCheckpoint, type LoadCheckpointResult } from './checkpoint';

const SESSIONS_BASE_DIR = path.join(process.cwd(), 'projects');

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
function getLogPath(projectName: string, sessionId: string): string {
  return path.join(SESSIONS_BASE_DIR, projectName, 'sessions', `${sessionId}.log`);
}

/**
 * Get the sessions directory path
 */
function getSessionsDir(projectName: string): string {
  return path.join(SESSIONS_BASE_DIR, projectName, 'sessions');
}

/**
 * Get the checkpoints directory path
 */
function getCheckpointsDir(projectName: string): string {
  return path.join(SESSIONS_BASE_DIR, projectName, 'sessions', 'checkpoints');
}

/**
 * Append a log entry to the session log file
 */
async function appendLog(
  projectName: string,
  sessionId: string,
  operation: string,
  details?: string
): Promise<void> {
  const logPath = getLogPath(projectName, sessionId);
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
async function readLog(projectName: string, sessionId: string): Promise<string[]> {
  const logPath = getLogPath(projectName, sessionId);

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
  mode: 'test-only' | 'test-and-fix'
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
    const saved = await saveCheckpoint(projectName, sessionId, initialData);
    if (!saved) {
      return null;
    }

    // Log the creation
    await appendLog(
      projectName,
      sessionId,
      'CREATE',
      `mode=${mode}, version=1.0.0`
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
  sessionId: string
): Promise<LoadCheckpointResult> {
  try {
    const data = await loadCheckpoint(projectName, sessionId);

    if (data !== null && typeof data === 'object' && 'ok' in data && !data.ok) {
      // Validation or parse error - log and return
      await appendLog(projectName, sessionId, 'RESUME_FAILED', `errorType=${data.errorType}`);
      return data;
    }

    if (data !== null) {
      await appendLog(projectName, sessionId, 'RESUME');
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
  finalData: unknown
): Promise<boolean> {
  try {
    // Update lastUpdated timestamp
    const dataWithTimestamp =
      typeof finalData === 'object' && finalData !== null
        ? { ...finalData, lastUpdated: new Date().toISOString() }
        : finalData;

    const saved = await saveCheckpoint(projectName, sessionId, dataWithTimestamp);

    if (saved) {
      await appendLog(projectName, sessionId, 'CLOSE', 'final checkpoint saved');
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
export async function listSessions(projectName: string): Promise<string[]> {
  try {
    const checkpointsDir = getCheckpointsDir(projectName);

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
  sessionId: string
): Promise<string[]> {
  return readLog(projectName, sessionId);
}

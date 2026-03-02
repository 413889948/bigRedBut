import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateCheckpoint, migrateCheckpoint, type CheckpointData } from './checkpoint-validator';

const CHECKPOINT_BASE_DIR = path.join(process.cwd(), 'projects');

/**
 * Get the checkpoint file path for a given project and session
 */
function getCheckpointPath(projectName: string, sessionId: string): string {
  return path.join(
    CHECKPOINT_BASE_DIR,
    projectName,
    'sessions',
    'checkpoints',
    `${sessionId}.json`
  );
}

/**
 * Result type for loadCheckpoint with validation
 */
export type LoadCheckpointResult = CheckpointData | null | { ok: false; errorType: 'parse'; error: string } | { ok: false; errorType: 'validation'; errors: string[] };

/**
 * Save a checkpoint atomically by writing to a temp file first, then renaming
 * @param projectName - Name of the project
 * @param sessionId - Unique session identifier
 * @param data - Checkpoint data object matching the schema
 * @returns true on success, false on failure
 */
export async function saveCheckpoint(
  projectName: string,
  sessionId: string,
  data: unknown
): Promise<boolean> {
  try {
    const checkpointPath = getCheckpointPath(projectName, sessionId);
    const dirPath = path.dirname(checkpointPath);
    const tmpPath = path.join(dirPath, `.${sessionId}.tmp`);

    // Ensure parent directories exist
    await fs.promises.mkdir(dirPath, { recursive: true });

    // Write to temp file first
    await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');

    // Atomic rename
    await fs.promises.rename(tmpPath, checkpointPath);

    return true;
  } catch (error) {
    console.error(`Failed to save checkpoint for ${projectName}/${sessionId}:`, error);
    return false;
  }
}

/**
 * Load a checkpoint file and validate it
 * @param projectName - Name of the project
 * @param sessionId - Unique session identifier
 * @returns Validated checkpoint data, null if not found, or structured error (never throws)
 */
export async function loadCheckpoint(
  projectName: string,
  sessionId: string
): Promise<LoadCheckpointResult> {
  try {
    const checkpointPath = getCheckpointPath(projectName, sessionId);

    // Check if file exists
    try {
      await fs.promises.access(checkpointPath);
    } catch {
      return null;
    }

    // Read and parse
    const content = await fs.promises.readFile(checkpointPath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      // JSON parse error - move corrupt file
      try {
        const timestamp = Date.now();
        const corruptPath = `${checkpointPath}.corrupt.${timestamp}.json`;
        await fs.promises.rename(checkpointPath, corruptPath);
        console.warn(`Moved corrupt checkpoint to ${corruptPath}`);
      } catch (moveError) {
        console.warn(`Failed to move corrupt checkpoint:`, moveError);
      }
      return { ok: false, errorType: 'parse', error: parseError instanceof Error ? parseError.message : 'JSON parse error' };
    }

    // Validate the parsed data
    const validation = validateCheckpoint(parsed);
    if (!validation.ok) {
      return validation;
    }

    // Optionally migrate if version differs
    const data = validation.data;
    if (data.version !== '1.0.0') {
      const migration = migrateCheckpoint(data as unknown as Record<string, unknown>, data.version, '1.0.0');
      if (!migration.ok) {
        return { ok: false, errorType: 'validation', errors: [migration.error] };
      }
      return migration.data;
    }

    return data;
  } catch (error) {
    console.error(`Failed to load checkpoint for ${projectName}/${sessionId}:`, error);
    return null;
  }
}

/**
 * Delete a checkpoint file if it exists
 * @param projectName - Name of the project
 * @param sessionId - Unique session identifier
 * @returns true if deleted, false if not found or on error (never throws)
 */
export async function deleteCheckpoint(
  projectName: string,
  sessionId: string
): Promise<boolean> {
  try {
    const checkpointPath = getCheckpointPath(projectName, sessionId);

    // Check if file exists
    try {
      await fs.promises.access(checkpointPath);
    } catch {
      return false;
    }

    // Delete the file
    await fs.promises.unlink(checkpointPath);
    return true;
  } catch (error) {
    console.error(`Failed to delete checkpoint for ${projectName}/${sessionId}:`, error);
    return false;
  }
}

// Re-export validator utilities for convenience
export { validateCheckpoint, migrateCheckpoint } from './checkpoint-validator';
export type {
  CheckpointData,
  CheckpointMode,
  TesterState,
  DeveloperState,
  KnowledgeState,
  ValidationResult,
  ValidationOk,
  ValidationErrors,
  MigrationResult,
  MigrationOk,
  MigrationError
} from './checkpoint-validator';

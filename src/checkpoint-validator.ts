/**
 * Checkpoint schema validation and migration utilities
 * Validates checkpoint data against the schema without external dependencies
 */

/** Valid mode values */
export type CheckpointMode = 'test-only' | 'test-and-fix';

/** Main checkpoint data structure */
export interface CheckpointData {
  version: string;
  sessionId: string;
  mode: CheckpointMode;
  lastUpdated: string;
  tester: TesterState;
  developer: DeveloperState;
  knowledge: KnowledgeState;
}

export interface TesterState {
  completedTasks: Array<{
    taskId: string;
    status: 'passed' | 'failed' | 'skipped';
    testFile?: string;
    executedAt?: string;
    failureDetails?: string;
  }>;
  currentTask?: string;
  currentStep?: number;
  totalSteps?: number;
  discoveredNewTasks?: Array<{
    taskId: string;
    description: string;
    priority?: 'high' | 'medium' | 'low';
    discoveredFrom?: string;
  }>;
  storageStatePath?: string;
}

export interface DeveloperState {
  completedFixes: Array<{
    bugId: string;
    status: 'fixed' | 'unable-to-fix' | 'deferred';
    testFile?: string;
    fixedFiles?: string[];
    attempts?: number;
    completedAt?: string;
  }>;
  currentFix?: {
    bugId: string;
    status: 'analyzing' | 'writing-test' | 'implementing-fix' | 'verifying';
    attempts: number;
    testFile?: string;
  };
}

export interface KnowledgeState {
  techStack: Array<{
    name: string;
    category: 'frontend' | 'backend' | 'database' | 'testing' | 'infrastructure' | 'other';
    version?: string;
    notes?: string;
  }>;
  gotchas: Array<{
    title: string;
    description: string;
    workaround?: string;
    severity?: 'critical' | 'major' | 'minor';
  }>;
  testNotes: Array<{
    topic: string;
    note: string;
    relatedTests?: string[];
  }>;
}

/** Validation result - success */
export interface ValidationOk {
  ok: true;
  data: CheckpointData;
}

/** Validation result - failure */
export interface ValidationErrors {
  ok: false;
  errorType: 'validation';
  errors: string[];
}

/** Combined validation result */
export type ValidationResult = ValidationOk | ValidationErrors;

/** Migration result - success */
export interface MigrationOk {
  ok: true;
  data: CheckpointData;
}

/** Migration result - failure */
export interface MigrationError {
  ok: false;
  error: string;
}

/** Combined migration result */
export type MigrationResult = MigrationOk | MigrationError;

/**
 * Validate checkpoint data against schema requirements
 * @param data - Raw checkpoint data to validate
 * @returns Validation result with ok/errors (never throws)
 */
export function validateCheckpoint(data: unknown): ValidationResult {
  const errors: string[] = [];

  // Type check root
  if (!data || typeof data !== 'object') {
    return {
      ok: false,
      errorType: 'validation',
      errors: ['Checkpoint data must be an object']
    };
  }

  const obj = data as Record<string, unknown>;

  // Required root keys
  const requiredKeys = ['version', 'sessionId', 'mode', 'lastUpdated', 'tester', 'developer', 'knowledge'];
  for (const key of requiredKeys) {
    if (!(key in obj)) {
      errors.push(`Missing required field: ${key}`);
    }
  }

  // If missing required fields, return early
  if (errors.length > 0) {
    return { ok: false, errorType: 'validation', errors };
  }

  // Validate version
  if (typeof obj.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(obj.version)) {
    errors.push('version must be a semver string (e.g., "1.0.0")');
  }

  // Validate sessionId
  if (typeof obj.sessionId !== 'string' || obj.sessionId.length === 0) {
    errors.push('sessionId must be a non-empty string');
  }

  // Validate mode
  if (obj.mode !== 'test-only' && obj.mode !== 'test-and-fix') {
    errors.push('mode must be "test-only" or "test-and-fix"');
  }

  // Validate lastUpdated (basic ISO 8601 check)
  if (typeof obj.lastUpdated !== 'string' || isNaN(Date.parse(obj.lastUpdated))) {
    errors.push('lastUpdated must be a valid ISO 8601 date string');
  }

  // Validate tester
  const tester = obj.tester;
  if (!tester || typeof tester !== 'object') {
    errors.push('tester must be an object');
  } else {
    const testerObj = tester as Record<string, unknown>;
    if (!Array.isArray(testerObj.completedTasks)) {
      errors.push('tester.completedTasks must be an array');
    }
  }

  // Validate developer
  const developer = obj.developer;
  if (!developer || typeof developer !== 'object') {
    errors.push('developer must be an object');
  } else {
    const devObj = developer as Record<string, unknown>;
    if (!Array.isArray(devObj.completedFixes)) {
      errors.push('developer.completedFixes must be an array');
    }
  }

  // Validate knowledge
  const knowledge = obj.knowledge;
  if (!knowledge || typeof knowledge !== 'object') {
    errors.push('knowledge must be an object');
  } else {
    const knowObj = knowledge as Record<string, unknown>;
    if (!Array.isArray(knowObj.techStack)) {
      errors.push('knowledge.techStack must be an array');
    }
    if (!Array.isArray(knowObj.gotchas)) {
      errors.push('knowledge.gotchas must be an array');
    }
    if (!Array.isArray(knowObj.testNotes)) {
      errors.push('knowledge.testNotes must be an array');
    }
  }

  if (errors.length > 0) {
    return { ok: false, errorType: 'validation', errors };
  }

  // All validations passed - cast to CheckpointData
  return {
    ok: true,
    data: data as CheckpointData
  };
}

/**
 * Migrate checkpoint data from one schema version to another
 * @param oldData - Existing checkpoint data
 * @param fromVersion - Source version string
 * @param toVersion - Target version string (default: '1.0.0')
 * @returns Migration result (never throws, never deletes user data)
 */
export function migrateCheckpoint(
  oldData: Record<string, unknown>,
  fromVersion: string,
  toVersion: string = '1.0.0'
): MigrationResult {
  try {
    let data = { ...oldData };

    // Fill missing required ROOT fields where safe
    // sessionId: if missing/empty, return error (cannot invent)
    if (typeof data.sessionId !== 'string' || data.sessionId.length === 0) {
      return { ok: false, error: 'Cannot migrate: sessionId is missing or empty' };
    }

    // version: set to toVersion
    data.version = toVersion;

    // mode: default 'test-only' if missing/invalid
    if (data.mode !== 'test-only' && data.mode !== 'test-and-fix') {
      data.mode = 'test-only';
    }

    // lastUpdated: set to now if missing/invalid
    if (typeof data.lastUpdated !== 'string' || isNaN(Date.parse(data.lastUpdated as string))) {
      data.lastUpdated = new Date().toISOString();
    }

    // Ensure tester object exists with required completedTasks
    if (!data.tester || typeof data.tester !== 'object') {
      data.tester = { completedTasks: [] };
    } else {
      const tester = data.tester as Record<string, unknown>;
      if (!Array.isArray(tester.completedTasks)) {
        tester.completedTasks = [];
      }
    }

    // Ensure developer object exists with required completedFixes
    if (!data.developer || typeof data.developer !== 'object') {
      data.developer = { completedFixes: [] };
    } else {
      const developer = data.developer as Record<string, unknown>;
      if (!Array.isArray(developer.completedFixes)) {
        developer.completedFixes = [];
      }
    }

    // Ensure knowledge object exists with required arrays
    if (!data.knowledge || typeof data.knowledge !== 'object') {
      data.knowledge = { techStack: [], gotchas: [], testNotes: [] };
    } else {
      const knowledge = data.knowledge as Record<string, unknown>;
      if (!Array.isArray(knowledge.techStack)) {
        knowledge.techStack = [];
      }
      if (!Array.isArray(knowledge.gotchas)) {
        knowledge.gotchas = [];
      }
      if (!Array.isArray(knowledge.testNotes)) {
        knowledge.testNotes = [];
      }
    }

    // Validate migrated data
    const result = validateCheckpoint(data);
    if (result.ok) {
      return { ok: true, data: result.data };
    } else {
      return { ok: false, error: `Migration failed validation: ${result.errors.join('; ')}` };
    }
  } catch (error) {
    return {
      ok: false,
      error: `Migration error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

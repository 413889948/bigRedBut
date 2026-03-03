import { loadCheckpoint, saveCheckpoint } from '../../../_skill-core/src/checkpoint';
import type { CheckpointData, TesterState, DeveloperState } from '../../../_skill-core/src/checkpoint-validator';
import type { ExecutionContext } from '../../../_skill-core/src/execution-context';

export interface SyncOptions {
  projectName: string;
  sessionId: string;
  context?: ExecutionContext;
}

export interface SyncTesterInput extends SyncOptions {
  testerState: Partial<TesterState>;
}

export interface SyncDeveloperInput extends SyncOptions {
  developerState: Partial<DeveloperState>;
}

export interface UpdateStateInput extends SyncOptions {
  updates: {
    tester?: Partial<TesterState>;
    developer?: Partial<DeveloperState>;
    knowledge?: Partial<CheckpointData['knowledge']>;
  };
}

export async function loadValidatedCheckpoint(
  projectName: string,
  sessionId: string,
  context?: ExecutionContext
): Promise<CheckpointData | null> {
  const result = await loadCheckpoint(projectName, sessionId, { context });

  if (result === null) {
    return null;
  }

  if (typeof result === 'object' && 'ok' in result && !result.ok) {
    console.error('Checkpoint validation failed:', result);
    return null;
  }

  return result as CheckpointData;
}

export async function syncTesterState(input: SyncTesterInput): Promise<boolean> {
  const { projectName, sessionId, testerState, context } = input;

  const checkpoint = await loadValidatedCheckpoint(projectName, sessionId, context);
  if (!checkpoint) {
    return false;
  }

  checkpoint.tester = {
    ...checkpoint.tester,
    ...testerState,
    completedTasks: testerState.completedTasks ?? checkpoint.tester.completedTasks,
    discoveredNewTasks: testerState.discoveredNewTasks ?? checkpoint.tester.discoveredNewTasks
  };

  checkpoint.lastUpdated = new Date().toISOString();

  return saveCheckpoint(projectName, sessionId, checkpoint, { context });
}

export async function syncDeveloperState(input: SyncDeveloperInput): Promise<boolean> {
  const { projectName, sessionId, developerState, context } = input;

  const checkpoint = await loadValidatedCheckpoint(projectName, sessionId, context);
  if (!checkpoint) {
    return false;
  }

  checkpoint.developer = {
    ...checkpoint.developer,
    ...developerState,
    completedFixes: developerState.completedFixes ?? checkpoint.developer.completedFixes
  };

  checkpoint.lastUpdated = new Date().toISOString();

  return saveCheckpoint(projectName, sessionId, checkpoint, { context });
}

export async function updateCheckpointState(input: UpdateStateInput): Promise<boolean> {
  const { projectName, sessionId, updates, context } = input;

  const checkpoint = await loadValidatedCheckpoint(projectName, sessionId, context);
  if (!checkpoint) {
    return false;
  }

  if (updates.tester) {
    checkpoint.tester = {
      ...checkpoint.tester,
      ...updates.tester,
      completedTasks: updates.tester.completedTasks ?? checkpoint.tester.completedTasks,
      discoveredNewTasks: updates.tester.discoveredNewTasks ?? checkpoint.tester.discoveredNewTasks
    };
  }

  if (updates.developer) {
    checkpoint.developer = {
      ...checkpoint.developer,
      ...updates.developer,
      completedFixes: updates.developer.completedFixes ?? checkpoint.developer.completedFixes
    };
  }

  if (updates.knowledge) {
    checkpoint.knowledge = {
      ...checkpoint.knowledge,
      ...updates.knowledge,
      techStack: updates.knowledge.techStack ?? checkpoint.knowledge.techStack,
      gotchas: updates.knowledge.gotchas ?? checkpoint.knowledge.gotchas,
      testNotes: updates.knowledge.testNotes ?? checkpoint.knowledge.testNotes
    };
  }

  checkpoint.lastUpdated = new Date().toISOString();

  return saveCheckpoint(projectName, sessionId, checkpoint, { context });
}

export interface RecordTestCompletionInput extends SyncOptions {
  taskId: string;
  status: 'passed' | 'failed' | 'skipped';
  testFile?: string;
  failureDetails?: string;
}

export async function recordTestCompletion(input: RecordTestCompletionInput): Promise<boolean> {
  const { projectName, sessionId, taskId, status, testFile, failureDetails, context } = input;

  const checkpoint = await loadValidatedCheckpoint(projectName, sessionId, context);
  if (!checkpoint) {
    return false;
  }

  const completedTask = {
    taskId,
    status,
    testFile,
    executedAt: new Date().toISOString(),
    failureDetails
  };

  const existingIndex = checkpoint.tester.completedTasks.findIndex(t => t.taskId === taskId);
  if (existingIndex >= 0) {
    checkpoint.tester.completedTasks[existingIndex] = completedTask;
  } else {
    checkpoint.tester.completedTasks.push(completedTask);
  }

  checkpoint.lastUpdated = new Date().toISOString();

  return saveCheckpoint(projectName, sessionId, checkpoint, { context });
}

export interface RecordFixCompletionInput extends SyncOptions {
  bugId: string;
  status: 'fixed' | 'unable-to-fix' | 'deferred';
  testFile?: string;
  fixedFiles?: string[];
  attempts: number;
}

export async function recordFixCompletion(input: RecordFixCompletionInput): Promise<boolean> {
  const { projectName, sessionId, bugId, status, testFile, fixedFiles, attempts, context } = input;

  const checkpoint = await loadValidatedCheckpoint(projectName, sessionId, context);
  if (!checkpoint) {
    return false;
  }

  const completedFix = {
    bugId,
    status,
    testFile,
    fixedFiles,
    attempts,
    completedAt: new Date().toISOString()
  };

  const existingIndex = checkpoint.developer.completedFixes.findIndex(f => f.bugId === bugId);
  if (existingIndex >= 0) {
    checkpoint.developer.completedFixes[existingIndex] = completedFix;
  } else {
    checkpoint.developer.completedFixes.push(completedFix);
  }

  checkpoint.developer.currentFix = undefined;
  checkpoint.lastUpdated = new Date().toISOString();

  return saveCheckpoint(projectName, sessionId, checkpoint, { context });
}

export interface UpdateFixProgressInput extends SyncOptions {
  bugId: string;
  status: 'analyzing' | 'writing-test' | 'implementing-fix' | 'verifying';
  attempts: number;
  testFile?: string;
}

export async function updateFixProgress(input: UpdateFixProgressInput): Promise<boolean> {
  const { projectName, sessionId, bugId, status, attempts, testFile, context } = input;

  const checkpoint = await loadValidatedCheckpoint(projectName, sessionId, context);
  if (!checkpoint) {
    return false;
  }

  checkpoint.developer.currentFix = {
    bugId,
    status,
    attempts,
    testFile
  };

  checkpoint.lastUpdated = new Date().toISOString();

  return saveCheckpoint(projectName, sessionId, checkpoint, { context });
}

export interface SessionSummary {
  sessionId: string;
  mode: CheckpointData['mode'];
  testerStats: {
    totalTasks: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  developerStats: {
    totalFixes: number;
    fixed: number;
    unableToFix: number;
    deferred: number;
    inProgress: boolean;
  };
  lastUpdated: string;
}

export async function getSessionSummary(
  projectName: string,
  sessionId: string,
  context?: ExecutionContext
): Promise<SessionSummary | null> {
  const checkpoint = await loadValidatedCheckpoint(projectName, sessionId, context);
  if (!checkpoint) {
    return null;
  }

  const testerStats = {
    totalTasks: checkpoint.tester.completedTasks.length,
    passed: checkpoint.tester.completedTasks.filter(t => t.status === 'passed').length,
    failed: checkpoint.tester.completedTasks.filter(t => t.status === 'failed').length,
    skipped: checkpoint.tester.completedTasks.filter(t => t.status === 'skipped').length
  };

  const developerStats = {
    totalFixes: checkpoint.developer.completedFixes.length,
    fixed: checkpoint.developer.completedFixes.filter(f => f.status === 'fixed').length,
    unableToFix: checkpoint.developer.completedFixes.filter(f => f.status === 'unable-to-fix').length,
    deferred: checkpoint.developer.completedFixes.filter(f => f.status === 'deferred').length,
    inProgress: checkpoint.developer.currentFix !== undefined
  };

  return {
    sessionId: checkpoint.sessionId,
    mode: checkpoint.mode,
    testerStats,
    developerStats,
    lastUpdated: checkpoint.lastUpdated
  };
}

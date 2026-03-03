import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  resolveDataDir,
  withExecutionContext,
  type ExecutionContext,
} from '../../_skill-core/src/execution-context';
import type { CheckpointData } from '../../_skill-core/src/checkpoint-validator';
import type { TestTask } from './tasks';

export type KnowledgeCategory = 'tech-stack' | 'gotchas' | 'test-guide';

interface DiscoveryNote {
  category: KnowledgeCategory;
  note: string;
}

export interface RecordDiscoveryInput {
  projectName: string;
  checkpoint: CheckpointData;
  discoveredTasks: TestTask[];
  notes: DiscoveryNote[];
  /** Data root for knowledge/checkpoint storage. Defaults to <cwd>/projects */
  dataDir?: string;
  /** Unified execution context */
  context?: ExecutionContext;
}

interface KnowledgePathOptions {
  dataDir?: string;
  context?: ExecutionContext;
}

function resolveDataRoot(options?: KnowledgePathOptions): string {
  const context = withExecutionContext(options?.context, {
    dataDir: options?.dataDir ?? options?.context?.dataDir,
  });
  return resolveDataDir(context);
}

const KNOWLEDGE_FILE_BY_CATEGORY: Record<KnowledgeCategory, string> = {
  'tech-stack': 'tech-stack.md',
  gotchas: 'gotchas.md',
  'test-guide': 'test-guide.md'
};

function getKnowledgeFilePath(
  projectName: string,
  category: KnowledgeCategory,
  options?: KnowledgePathOptions,
): string {
  return path.join(resolveDataRoot(options), projectName, 'knowledge', KNOWLEDGE_FILE_BY_CATEGORY[category]);
}

function toDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toBulletLines(note: string): string[] {
  return note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `- ${line}`);
}

export async function appendKnowledgeNote(
  projectName: string,
  category: KnowledgeCategory,
  note: string,
  options?: KnowledgePathOptions,
): Promise<string> {
  const knowledgePath = getKnowledgeFilePath(projectName, category, options);
  const knowledgeDir = path.dirname(knowledgePath);

  await mkdir(knowledgeDir, { recursive: true });

  let existing = '';
  try {
    existing = await readFile(knowledgePath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw error;
    }
  }

  const bullets = toBulletLines(note);
  if (bullets.length === 0) {
    return knowledgePath;
  }

  const prefix = existing.length === 0 ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  const entry = [`## ${toDateStamp(new Date())}`, ...bullets, ''].join('\n');

  await appendFile(knowledgePath, `${prefix}${entry}`, 'utf8');

  return knowledgePath;
}

function mergeDiscoveredCheckpointTasks(
  existing: NonNullable<CheckpointData['tester']['discoveredNewTasks']>,
  discovered: TestTask[]
): NonNullable<CheckpointData['tester']['discoveredNewTasks']> {
  const byTaskId = new Map<string, (typeof existing)[number]>();

  for (const task of existing) {
    byTaskId.set(task.taskId, task);
  }

  for (const task of discovered) {
    byTaskId.set(task.id, {
      taskId: task.id,
      description: task.description,
      priority: task.priority,
      discoveredFrom: task.discoveredFrom
    });
  }

  return Array.from(byTaskId.values());
}

export async function recordDiscovery(input: RecordDiscoveryInput): Promise<CheckpointData> {
  const { projectName, checkpoint, discoveredTasks, notes, dataDir, context } = input;

  const existingTasks = checkpoint.tester.discoveredNewTasks ?? [];
  checkpoint.tester.discoveredNewTasks = mergeDiscoveredCheckpointTasks(existingTasks, discoveredTasks);

  for (const note of notes) {
    await appendKnowledgeNote(projectName, note.category, note.note, { dataDir, context });
  }

  return checkpoint;
}

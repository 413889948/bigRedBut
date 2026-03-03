import { appendFile, mkdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import {
  resolveDataDir,
  withExecutionContext,
  type ExecutionContext,
} from '../../_skill-core/src/execution-context';
import type { TddAttemptLog } from './tdd-loop';

export type KnowledgeCategory = 'gotchas' | 'test-guide';

export interface UpdateKnowledgeInput {
  projectName: string;
  tddLogs: TddAttemptLog[];
  categories?: KnowledgeCategory[];
  dataDir?: string;
  context?: ExecutionContext;
}

export interface UpdateKnowledgeResult {
  updatedFiles: string[];
  notes: KnowledgeNote[];
}

interface KnowledgeNote {
  category: KnowledgeCategory;
  content: string;
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
  gotchas: 'gotchas.md',
  'test-guide': 'test-guide.md',
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

export async function updateKnowledge(input: UpdateKnowledgeInput): Promise<UpdateKnowledgeResult> {
  const { projectName, tddLogs, categories = ['gotchas', 'test-guide'], dataDir, context } = input;
  const updatedFiles: string[] = [];
  const notes: KnowledgeNote[] = [];

  const gotchaNotes = extractGotchas(tddLogs);
  if (gotchaNotes.length > 0 && categories.includes('gotchas')) {
    const joinedNote = gotchaNotes.join('\n');
    const filePath = await appendKnowledgeNote(projectName, 'gotchas', joinedNote, { dataDir, context });
    updatedFiles.push(filePath);
    notes.push({ category: 'gotchas', content: joinedNote });
  }

  const testGuideNotes = extractTestGuide(tddLogs);
  if (testGuideNotes.length > 0 && categories.includes('test-guide')) {
    const joinedNote = testGuideNotes.join('\n');
    const filePath = await appendKnowledgeNote(projectName, 'test-guide', joinedNote, { dataDir, context });
    updatedFiles.push(filePath);
    notes.push({ category: 'test-guide', content: joinedNote });
  }

  return {
    updatedFiles,
    notes,
  };
}

function extractGotchas(logs: TddAttemptLog[]): string[] {
  const gotchas: string[] = [];

  for (const log of logs) {
    if (!log.ok && log.phase === 'apply-fix') {
      const gotcha = formatGotchaFromFailure(log);
      if (gotcha) {
        gotchas.push(gotcha);
      }
    }

    if (!log.ok && log.phase === 'verify') {
      const gotcha = formatGotchaFromVerification(log);
      if (gotcha) {
        gotchas.push(gotcha);
      }
    }
  }

  return gotchas;
}

function extractTestGuide(logs: TddAttemptLog[]): string[] {
  const guides: string[] = [];

  for (const log of logs) {
    if (log.ok && log.phase === 'verify' && log.changedFiles && log.changedFiles.length > 0) {
      const guide = formatGuideFromSuccess(log);
      if (guide) {
        guides.push(guide);
      }
    }
  }

  return guides;
}

function formatGotchaFromFailure(log: TddAttemptLog): string | null {
  const { failure, attempt, message } = log;

  const titlePart = failure.title ? `"${failure.title}"` : 'Unknown test';
  const filePart = failure.file ? ` in ${normalizePath(failure.file)}` : '';

  const lines = [
    `Fix attempt #${attempt} failed for ${titlePart}${filePart}`,
    `Error: ${message}`,
  ];

  if (failure.errorMessages && failure.errorMessages.length > 0) {
    lines.push(`Details: ${failure.errorMessages[0]}`);
  }

  return lines.join('\n');
}

function formatGotchaFromVerification(log: TddAttemptLog): string | null {
  const { failure, attempt, message } = log;

  const titlePart = failure.title ? `"${failure.title}"` : 'Unknown test';
  const filePart = failure.file ? ` in ${normalizePath(failure.file)}` : '';

  return `Verification failed on attempt #${attempt} for ${titlePart}${filePart}: ${message}`;
}

function formatGuideFromSuccess(log: TddAttemptLog): string | null {
  const { failure, attempt, changedFiles } = log;

  if (!changedFiles || changedFiles.length === 0) {
    return null;
  }

  const titlePart = failure.title ? `"${failure.title}"` : 'Unknown test';
  const filesPart = changedFiles.map((f) => normalizePath(f)).join(', ');

  return `Fixed ${titlePart} on attempt #${attempt} by modifying: ${filesPart}`;
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

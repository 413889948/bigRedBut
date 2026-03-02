import { appendFile, mkdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { TddAttemptLog } from './tdd-loop';
import type { FailureCase } from './parse-report';

export type KnowledgeCategory = 'gotchas' | 'test-guide';

export interface UpdateKnowledgeInput {
  /** Project name for knowledge file paths */
  projectName: string;
  /** TDD logs to analyze for knowledge extraction */
  tddLogs: TddAttemptLog[];
  /** Categories to update */
  categories?: KnowledgeCategory[];
}

export interface UpdateKnowledgeResult {
  /** Files that were updated */
  updatedFiles: string[];
  /** Knowledge notes that were appended */
  notes: KnowledgeNote[];
}

interface KnowledgeNote {
  category: KnowledgeCategory;
  content: string;
}

const PROJECTS_ROOT = path.join(process.cwd(), 'projects');

const KNOWLEDGE_FILE_BY_CATEGORY: Record<KnowledgeCategory, string> = {
  gotchas: 'gotchas.md',
  'test-guide': 'test-guide.md',
};

function getKnowledgeFilePath(projectName: string, category: KnowledgeCategory): string {
  return path.join(PROJECTS_ROOT, projectName, 'knowledge', KNOWLEDGE_FILE_BY_CATEGORY[category]);
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

/**
 * Appends a knowledge note to a project's knowledge file.
 * Follows append-only convention with date-stamped sections.
 */
export async function appendKnowledgeNote(
  projectName: string,
  category: KnowledgeCategory,
  note: string
): Promise<string> {
  const knowledgePath = getKnowledgeFilePath(projectName, category);
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

/**
 * Analyzes TDD logs and extracts knowledge notes for gotchas and test-guide.
 * Appends findings to project knowledge files (append-only).
 */
export async function updateKnowledge(input: UpdateKnowledgeInput): Promise<UpdateKnowledgeResult> {
  const { projectName, tddLogs, categories = ['gotchas', 'test-guide'] } = input;
  const updatedFiles: string[] = [];
  const notes: KnowledgeNote[] = [];

  // Extract gotchas from failed attempts
  const gotchaNotes = extractGotchas(tddLogs);
  if (gotchaNotes.length > 0 && categories.includes('gotchas')) {
    const joinedNote = gotchaNotes.join('\n');
    const filePath = await appendKnowledgeNote(projectName, 'gotchas', joinedNote);
    updatedFiles.push(filePath);
    notes.push({ category: 'gotchas', content: joinedNote });
  }

  // Extract test-guide insights from successful fixes
  const testGuideNotes = extractTestGuide(tddLogs);
  if (testGuideNotes.length > 0 && categories.includes('test-guide')) {
    const joinedNote = testGuideNotes.join('\n');
    const filePath = await appendKnowledgeNote(projectName, 'test-guide', joinedNote);
    updatedFiles.push(filePath);
    notes.push({ category: 'test-guide', content: joinedNote });
  }

  return {
    updatedFiles,
    notes,
  };
}

/**
 * Extracts gotchas (problems and blockers) from TDD logs
 */
function extractGotchas(logs: TddAttemptLog[]): string[] {
  const gotchas: string[] = [];

  for (const log of logs) {
    if (!log.ok && log.phase === 'apply-fix') {
      // Failed fix attempt - record as gotcha
      const gotcha = formatGotchaFromFailure(log);
      if (gotcha) {
        gotchas.push(gotcha);
      }
    }

    if (!log.ok && log.phase === 'verify') {
      // Verification failed - record what didn't work
      const gotcha = formatGotchaFromVerification(log);
      if (gotcha) {
        gotchas.push(gotcha);
      }
    }
  }

  return gotchas;
}

/**
 * Extracts test-guide insights (what worked) from TDD logs
 */
function extractTestGuide(logs: TddAttemptLog[]): string[] {
  const guides: string[] = [];

  for (const log of logs) {
    if (log.ok && log.phase === 'verify' && log.changedFiles && log.changedFiles.length > 0) {
      // Successful fix that passed verification
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
  // Normalize to forward slashes for cross-platform compatibility
  return filePath.split(path.sep).join('/');
}

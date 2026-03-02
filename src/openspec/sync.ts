import * as fs from 'node:fs';
import * as path from 'node:path';

interface SyncOpenSpecChangeArtifactsOptions {
  changeName: string;
  projectName: string;
  sessionId: string;
  baseURL?: string;
  jsonReportPath?: string;
}

interface SyncResult {
  created: string[];
  skipped: string[];
  errors: string[];
}

/**
 * Ensures OpenSpec change artifacts exist by copying from schema templates.
 * Only creates missing files; never overwrites existing artifacts.
 *
 * @param options - Sync configuration
 * @returns Result with created, skipped, and error lists
 */
export function syncOpenSpecChangeArtifacts(
  options: SyncOpenSpecChangeArtifactsOptions
): SyncResult {
  const { changeName, projectName, sessionId, baseURL = 'about:blank', jsonReportPath = 'test-results/tmp-results.json' } = options;

  const result: SyncResult = {
    created: [],
    skipped: [],
    errors: [],
  };

  // Resolve paths
  const projectRoot = process.cwd();
  const changesDir = path.join(projectRoot, 'openspec', 'changes', changeName);
  const schemasDir = path.join(projectRoot, 'openspec', 'schemas', 'web-test-session', 'templates');

  // Ensure change directory exists
  try {
    fs.mkdirSync(changesDir, { recursive: true });
  } catch (error) {
    result.errors.push(`Failed to create change directory: ${changesDir}`);
    return result;
  }

  // Artifact files to create
  const artifacts = ['test-report.md', 'fix-log.md', 'tasks.md'];

  for (const artifact of artifacts) {
    const templatePath = path.join(schemasDir, artifact);
    const targetPath = path.join(changesDir, artifact);

    // Skip if already exists (safety: never overwrite)
    if (fs.existsSync(targetPath)) {
      result.skipped.push(artifact);
      continue;
    }

    // Check template exists
    if (!fs.existsSync(templatePath)) {
      result.errors.push(`Template not found: ${templatePath}`);
      continue;
    }

    try {
      // Read template
      let content = fs.readFileSync(templatePath, 'utf-8');

      // Substitute placeholders with safe defaults
      const substitutions: Record<string, string> = {
        '{{projectName}}': projectName,
        '{{sessionId}}': sessionId,
        '{{change-name}}': changeName,
        '{{date}}': new Date().toISOString().split('T')[0],
        '{{jsonReportPath}}': jsonReportPath,
        '{{baseURL}}': baseURL,
        '{{playwrightCommand}}': 'npx playwright test --workers=1',
        '{{totalTests}}': '0',
        '{{passedCount}}': '0',
        '{{failedCount}}': '0',
        '{{totalAttempts}}': '0',
        '{{successfulAttempts}}': '0',
        '{{failedAttempts}}': '0',
        '{{successRate}}': '0',
      };

      for (const [placeholder, value] of Object.entries(substitutions)) {
        content = content.replaceAll(placeholder, value);
      }

      // Strip handlebars blocks and placeholders
      // Strategy: repeatedly remove innermost blocks until none remain,
      // then strip any leftover placeholders
      let prevContent;
      do {
        prevContent = content;
        // Remove innermost {{#each}}...{{/each}} blocks (non-greedy, no nested blocks inside)
        content = content.replace(/{{#each\s+\w+}}[\s\S]*?{{\/each}}/g, '');
        // Remove innermost {{#if}}...{{/if}} blocks (non-greedy)
        content = content.replace(/{{#if\s+[^}]+}}[\s\S]*?{{\/if}}/g, '');
      } while (content !== prevContent);

      // Remove any remaining {{...}} placeholders not substituted
      content = content.replace(/{{[^}]+}}/g, '');

      // Clean up excessive blank lines (3+ consecutive newlines -> 2)
      content = content.replace(/\n{3,}/g, '\n\n');

      // Write artifact
      fs.writeFileSync(targetPath, content, 'utf-8');
      result.created.push(artifact);
    } catch (error) {
      result.errors.push(`Failed to create ${artifact}: ${(error as Error).message}`);
    }
  }

  return result;
}

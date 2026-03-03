import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DiscoverSiteResult } from './discover';

export interface GenerateTestsOptions {
  outputFile?: string;
}

const DEFAULT_OUTPUT_FILE = path.join('tests', 'e2e', 'generated', 'discovered.spec.ts');

function sortedRoutes(routes: string[]): string[] {
  return [...routes].sort((a, b) => a.localeCompare(b));
}

function getUniqueTitles(routes: string[]): string[] {
  const seen = new Map<string, number>();
  return routes.map((route) => {
    const baseTitle = `route: ${route}`;
    const count = (seen.get(baseTitle) ?? 0) + 1;
    seen.set(baseTitle, count);

    if (count === 1) {
      return baseTitle;
    }

    return `${baseTitle} (${count})`;
  });
}

export function createDiscoveredSpec(discovery: Pick<DiscoverSiteResult, 'routes' | 'urls'>): string {
  const routes = discovery.routes.length > 0 ? discovery.routes : discovery.urls;
  const orderedRoutes = sortedRoutes(routes);
  const titles = getUniqueTitles(orderedRoutes);

  const body = orderedRoutes
    .map((route, index) => {
      const title = titles[index];
      return [
        `  test(${JSON.stringify(title)}, async ({ page }) => {`,
        `    await page.goto(${JSON.stringify(route)});`,
        '    await expect(page).toHaveTitle(/.*/);',
        '  });'
      ].join('\n');
    })
    .join('\n\n');

  return [
    "import { test, expect } from '@playwright/test';",
    '',
    "test.describe('discovered routes', () => {",
    body,
    '});',
    ''
  ].join('\n');
}

export async function writeDiscoveredSpec(
  discovery: Pick<DiscoverSiteResult, 'routes' | 'urls'>,
  options: GenerateTestsOptions = {}
): Promise<string> {
  const outputFile = options.outputFile ?? DEFAULT_OUTPUT_FILE;
  const outputDirectory = path.dirname(outputFile);

  await mkdir(outputDirectory, { recursive: true });
  const content = createDiscoveredSpec(discovery);
  await writeFile(outputFile, content, 'utf8');

  return outputFile;
}

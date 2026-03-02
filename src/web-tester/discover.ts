import { chromium } from 'playwright';

export interface DiscoverSiteOptions {
  baseURL: string;
  maxPages?: number;
  maxDepth?: number;
  timeoutMs?: number;
  preserveQuery?: boolean;
}

export interface DiscoverSiteResult {
  baseURL: string;
  urls: string[];
  routes: string[];
  visitedCount: number;
}

interface QueueItem {
  url: string;
  depth: number;
}

const DEFAULT_MAX_PAGES = 25;
const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_TIMEOUT_MS = 10_000;

function normalizeUrl(value: string | URL, preserveQuery: boolean): string {
  const url = value instanceof URL ? new URL(value.toString()) : new URL(value);
  url.hash = '';

  if (!preserveQuery) {
    url.search = '';
  }

  if (url.protocol === 'http:' || url.protocol === 'https:') {
    const normalizedPath = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : '/';
    url.pathname = normalizedPath || '/';
  }

  return url.toString();
}

function toRoute(urlText: string, preserveQuery: boolean): string {
  const url = new URL(urlText);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return url.toString();
  }

  const pathname = url.pathname || '/';
  if (!preserveQuery) {
    return pathname;
  }

  return `${pathname}${url.search}`;
}

function resolveSameOriginUrl(rawHref: string, currentUrl: string, baseOrigin: string): URL | null {
  if (!rawHref) {
    return null;
  }

  const trimmed = rawHref.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  let resolved: URL;
  try {
    resolved = new URL(trimmed, currentUrl);
  } catch {
    return null;
  }

  if (resolved.origin !== baseOrigin) {
    return null;
  }

  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:' && resolved.protocol !== 'about:') {
    return null;
  }

  return resolved;
}

export async function discoverSite(options: DiscoverSiteOptions): Promise<DiscoverSiteResult> {
  const maxPages = Math.max(1, options.maxPages ?? DEFAULT_MAX_PAGES);
  const maxDepth = Math.max(0, options.maxDepth ?? DEFAULT_MAX_DEPTH);
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const preserveQuery = options.preserveQuery ?? true;

  const normalizedBaseURL = normalizeUrl(options.baseURL, preserveQuery);
  const baseOrigin = new URL(normalizedBaseURL).origin;

  const queue: QueueItem[] = [{ url: normalizedBaseURL, depth: 0 }];
  const seen = new Set<string>();
  const visitedUrls: string[] = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(timeoutMs);
  page.setDefaultTimeout(timeoutMs);

  try {
    while (queue.length > 0 && visitedUrls.length < maxPages) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      if (seen.has(current.url)) {
        continue;
      }

      seen.add(current.url);
      visitedUrls.push(current.url);

      try {
        await page.goto(current.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      } catch {
        continue;
      }

      if (current.depth >= maxDepth) {
        continue;
      }

      const hrefs = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
        return anchors
          .map((anchor) => anchor.getAttribute('href'))
          .filter((href): href is string => typeof href === 'string' && href.trim().length > 0);
      });

      for (const href of hrefs) {
        if (queue.length + visitedUrls.length >= maxPages) {
          break;
        }

        const resolved = resolveSameOriginUrl(href, current.url, baseOrigin);
        if (!resolved) {
          continue;
        }

        const normalized = normalizeUrl(resolved, preserveQuery);
        if (seen.has(normalized) || queue.some((item) => item.url === normalized)) {
          continue;
        }

        queue.push({ url: normalized, depth: current.depth + 1 });
      }
    }
  } finally {
    await page.close();
    await browser.close();
  }

  const routeSet = new Set<string>();
  const routes: string[] = [];
  for (const url of visitedUrls) {
    const route = toRoute(url, preserveQuery);
    if (!routeSet.has(route)) {
      routeSet.add(route);
      routes.push(route);
    }
  }

  return {
    baseURL: normalizedBaseURL,
    urls: visitedUrls,
    routes,
    visitedCount: visitedUrls.length
  };
}

import * as fs from 'node:fs';

export interface FailureCase {
  title: string;
  file: string;
  line?: number;
  column?: number;
  projectName?: string;
  status: string;
  errorMessages: string[];
}

interface PlaywrightJsonReport {
  config?: unknown;
  suites?: Suite[];
  errors?: unknown[];
  stats?: unknown;
}

interface Suite {
  title: string;
  file: string;
  line?: number;
  column?: number;
  specs?: Spec[];
  suites?: Suite[];
}

interface Spec {
  title: string;
  ok?: boolean;
  tags?: string[];
  tests?: Test[];
  file?: string;
  line?: number;
  column?: number;
  id?: string;
}

interface Test {
  timeout?: number;
  annotations?: unknown[];
  expectedStatus?: string;
  projectId?: string;
  projectName?: string;
  results?: Result[];
  status?: string;
}

interface Result {
  workerIndex?: number;
  parallelIndex?: number;
  status?: string;
  duration?: number;
  errors?: ErrorItem[];
  stdout?: unknown[];
  stderr?: unknown[];
  retry?: number;
  startTime?: string;
  annotations?: unknown[];
  attachments?: unknown[];
}

interface ErrorItem {
  message?: string;
  stack?: string;
}

function extractErrorMessages(result: Result): string[] {
  const messages: string[] = [];
  if (result.errors) {
    for (const error of result.errors) {
      if (error.message) {
        messages.push(error.message);
      } else if (error.stack) {
        messages.push(error.stack);
      }
    }
  }
  return messages;
}

function collectFailuresFromSpec(spec: Spec, file: string, failures: FailureCase[]): void {
  // Check if spec itself is marked as not ok
  const specNotOk = spec.ok === false;

  if (spec.tests) {
    for (const test of spec.tests) {
      const isUnexpected = test.status === 'unexpected';
      
      if (test.results) {
        for (const result of test.results) {
          const isFailed = result.status && ['failed', 'timedOut', 'interrupted'].includes(result.status);
          
          if (specNotOk || isUnexpected || isFailed) {
            const errorMessages = extractErrorMessages(result);
            failures.push({
              title: spec.title,
              file,
              line: spec.line,
              column: spec.column,
              projectName: test.projectName,
              status: result.status || test.status || 'failed',
              errorMessages,
            });
          }
        }
      } else if (specNotOk || isUnexpected) {
        // No results but still failed
        failures.push({
          title: spec.title,
          file,
          line: spec.line,
          column: spec.column,
          projectName: test.projectName,
          status: test.status || 'failed',
          errorMessages: [],
        });
      }
    }
  } else if (specNotOk) {
    // Spec with no tests but marked not ok
    failures.push({
      title: spec.title,
      file,
      line: spec.line,
      column: spec.column,
      projectName: undefined,
      status: 'failed',
      errorMessages: [],
    });
  }
}

function traverseSuites(suites: Suite[] | undefined, failures: FailureCase[]): void {
  if (!suites) {
    return;
  }
  
  for (const suite of suites) {
    // Collect failures from specs in this suite
    if (suite.specs) {
      const file = suite.file || '';
      for (const spec of suite.specs) {
        collectFailuresFromSpec(spec, file, failures);
      }
    }
    
    // Recursively traverse nested suites
    if (suite.suites) {
      traverseSuites(suite.suites, failures);
    }
  }
}

export function parsePlaywrightJsonReport(json: unknown): { ok: true; failures: FailureCase[] } | { ok: false; error: string } {
  try {
    if (typeof json !== 'object' || json === null) {
      return { ok: false, error: 'Invalid input: expected an object' };
    }

    const report = json as PlaywrightJsonReport;
    
    if (!report.suites) {
      return { ok: false, error: 'Invalid report: missing suites property' };
    }

    const failures: FailureCase[] = [];
    traverseSuites(report.suites, failures);
    
    return { ok: true, failures };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

export function loadAndParsePlaywrightJsonReport(filePath: string): { ok: true; failures: FailureCase[] } | { ok: false; error: string } {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);
    return parsePlaywrightJsonReport(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

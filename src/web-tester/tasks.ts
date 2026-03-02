export type TestTaskPriority = 'high' | 'medium' | 'low';

export type TestTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface TestTask {
  id: string;
  description: string;
  priority: TestTaskPriority;
  discoveredFrom?: string;
  status: TestTaskStatus;
}

export function mergeDiscoveredTasks(existing: TestTask[], discovered: TestTask[]): TestTask[] {
  const byId = new Map<string, TestTask>();

  for (const task of existing) {
    byId.set(task.id, task);
  }

  for (const task of discovered) {
    byId.set(task.id, task);
  }

  return Array.from(byId.values());
}

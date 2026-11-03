import { describe, expect, it, vi } from 'vitest';

/* A host suite that stubs the scheduled-tasks lib without its run-status enum. */
vi.mock('@epam/ai-dial-scheduled-tasks', () => ({}));

describe('scheduled-task-display with a stubbed scheduled-tasks lib', () => {
  it('imports without reading the run-status enum', async () => {
    const module = await import('../scheduled-task-display');

    expect(module.classifyScheduledTaskDeleteError(404)).toBe(
      module.ScheduledTaskDeleteErrorKind.NotFound,
    );
  });
});

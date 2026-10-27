import { ScheduledTaskRepeat } from '@epam/ai-dial-scheduled-tasks';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useScheduledTaskFormLabels } from '../useScheduledTaskFormLabels';

describe('useScheduledTaskFormLabels', () => {
  it('shares repeat options while selecting the mode-specific actions', () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: 'create' | 'edit' }) =>
        useScheduledTaskFormLabels(mode),
      { initialProps: { mode: 'create' as 'create' | 'edit' } },
    );
    expect(result.current.repeatOptions).toHaveLength(6);
    expect(result.current.repeatOptions).toContainEqual({
      key: ScheduledTaskRepeat.Custom,
      label: 'scheduledTasks.create.repeatCustom',
    });
    expect(result.current.createButtonLabel).toBe('buttons.create');

    rerender({ mode: 'edit' });
    expect(result.current.createButtonLabel).toBe('buttons.save');
  });
});

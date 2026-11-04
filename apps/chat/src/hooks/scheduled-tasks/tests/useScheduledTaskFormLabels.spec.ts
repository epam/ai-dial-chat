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

  it('translates the discard confirmation with the shared unsaved-changes copy', () => {
    const { result } = renderHook(() => useScheduledTaskFormLabels('create'));

    expect(result.current).toMatchObject({
      discardTitle: 'unsavedChanges.title',
      discardMessage: 'unsavedChanges.message',
      discardConfirmLabel: 'unsavedChanges.confirmLabel',
      discardConfirmMobileLabel: 'unsavedChanges.confirmLabelMobile',
      discardCancelLabel: 'unsavedChanges.cancelLabel',
    });
  });
});

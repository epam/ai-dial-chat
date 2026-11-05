import { ScheduledTaskRepeat } from '@epam/ai-dial-scheduled-tasks';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useScheduledTaskFormLabels } from '../useScheduledTaskFormLabels';

/* A Russian browser with only English resources: i18next keeps the detected
 * `ru` as `language` while the UI renders the resolved `en` bundle. */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', resolvedLanguage: 'en', changeLanguage: vi.fn() },
  }),
}));

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
    expect(result.current.daysOfWeekLabel).toBe(
      'scheduledTasks.create.daysOfWeekLabel',
    );
    expect(result.current).not.toHaveProperty('everyLabel');
    expect(result.current).not.toHaveProperty('everyWeekOptions');

    rerender({ mode: 'edit' });
    expect(result.current.createButtonLabel).toBe('buttons.save');
  });

  it('names the Custom weekdays in the rendered language, not the detected one', () => {
    const { result } = renderHook(() => useScheduledTaskFormLabels('create'));

    expect(result.current.customDayOptions[0]).toEqual({
      value: '0',
      shortLabel: 'M',
      fullName: 'Monday',
    });
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

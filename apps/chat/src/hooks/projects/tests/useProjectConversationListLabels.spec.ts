import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ButtonsI18nKeys,
  ProjectsI18nKeys,
} from '../../../constants/translation-keys';
import { useProjectConversationListLabels } from '../useProjectConversationListLabels';

describe('useProjectConversationListLabels', () => {
  it('resolves the list strings from the projects namespace', () => {
    const { result } = renderHook(() => useProjectConversationListLabels());

    expect(result.current.title).toBe(ProjectsI18nKeys.ChatsTitle);
    expect(result.current.emptyTitle).toBe(ProjectsI18nKeys.ChatsEmpty);
    expect(result.current.emptyDescription).toBe(
      ProjectsI18nKeys.ChatsEmptyDescription,
    );
    expect(result.current.renameLabel).toBe(ButtonsI18nKeys.Rename);
    expect(result.current.retryLabel).toBe(ButtonsI18nKeys.Retry);
  });

  it('names a row with the author only when it has one', () => {
    const { result } = renderHook(() => useProjectConversationListLabels());

    expect(result.current.openLabel('Chat', 'Valery')).toBe(
      ProjectsI18nKeys.ChatsOpenLabel,
    );
    expect(result.current.openLabel('Chat')).toBe(
      ProjectsI18nKeys.ChatsOpenLabelNoAuthor,
    );
  });

  it('keeps the same labels object between renders', () => {
    const { result, rerender } = renderHook(() =>
      useProjectConversationListLabels(),
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useVisibleConversationIdsReporter } from '../useVisibleConversationIdsReporter';

const toPanelConversationId = (id: string) => `panel:${id}`;
const items = [{ id: 'a' }, { id: 'b' }];

const renderReporter = (isVisible = true) => {
  const setVisibleConversationIds = vi.fn();
  const hook = renderHook(
    ({ isVisible: visible }) =>
      useVisibleConversationIdsReporter({
        items,
        isVisible: visible,
        toPanelConversationId,
        setVisibleConversationIds,
      }),
    { initialProps: { isVisible } },
  );
  return { ...hook, setVisibleConversationIds };
};

describe('useVisibleConversationIdsReporter', () => {
  it('registers the list ids behind the reported panel ids, skipping unknown ones', () => {
    const { result, setVisibleConversationIds } = renderReporter();

    act(() => result.current(['panel:b', 'panel:missing']));

    expect(setVisibleConversationIds).toHaveBeenLastCalledWith(
      expect.any(String),
      ['b'],
    );
  });

  it('withdraws the ids while hidden and restores the last report when shown again', () => {
    const { result, rerender, setVisibleConversationIds } = renderReporter();
    act(() => result.current(['panel:a']));

    rerender({ isVisible: false });
    expect(setVisibleConversationIds).toHaveBeenLastCalledWith(
      expect.any(String),
      null,
    );

    rerender({ isVisible: true });
    expect(setVisibleConversationIds).toHaveBeenLastCalledWith(
      expect.any(String),
      ['a'],
    );
  });

  it('withdraws the ids on unmount', () => {
    const { unmount, setVisibleConversationIds } = renderReporter();

    unmount();

    expect(setVisibleConversationIds).toHaveBeenLastCalledWith(
      expect.any(String),
      null,
    );
  });
});

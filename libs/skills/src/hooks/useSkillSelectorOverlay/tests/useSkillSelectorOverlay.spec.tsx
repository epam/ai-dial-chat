import { act, renderHook } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SkillListingEntry } from '../../../models/favorite-skill-item';
import type { UseSkillSelectorOverlayOptions } from '../../../models/skill-selector-overlay';
import { useSkillSelectorOverlay } from '../useSkillSelectorOverlay';

const abcSkill: SkillListingEntry = { url: 'skills/bucket/abc', name: 'abc' };
const csdSkill: SkillListingEntry = { url: 'skills/bucket/csd', name: 'csd' };

const baseOptions: UseSkillSelectorOverlayOptions = {
  isEnabled: true,
  isSkillsSupported: true,
  skills: [abcSkill, csdSkill],
  favoriteIds: new Set(),
  onToggleFavorite: vi.fn(),
  renderCatalogContent: () => null,
  detailsPanelComponent: () => null,
};

/* `renderMenu`/`renderOverlay` return a `<FavoriteSkillsPanel>` element; the
   panel's own rendering/interaction is out of this hook's scope, so calling
   its `onSelect` prop directly exercises the hook's selection wiring without
   mounting the panel. */
const getOnSelect = (
  element: ReactElement,
): ((item: { id: string; name: string }) => void) =>
  (element.props as { onSelect: (item: { id: string; name: string }) => void })
    .onSelect;

describe('useSkillSelectorOverlay', () => {
  it('tracks a mention selected via the slash command menu', () => {
    const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

    const close = vi.fn();
    const menu = result.current.commandMenu!.renderMenu({
      query: '',
      caretPosition: 0,
      close,
    }) as ReactElement;

    act(() => {
      getOnSelect(menu)({ id: abcSkill.url, name: abcSkill.name });
    });

    expect(close).toHaveBeenCalledWith({ consumeQuery: true });
    expect(result.current.message).toBe('/abc ');
    expect(result.current.activeMentions).toEqual([
      {
        start: 0,
        length: 4,
        isUnsupported: false,
        render: expect.any(Function),
      },
    ]);
    expect(result.current.selectedSkills).toEqual([{ url: abcSkill.url }]);
    expect(result.current.caretPositionOverride).toBe(5);
  });

  it('tracks two mentions selected via the slash menu then the add menu, in order', () => {
    const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

    act(() => {
      const menu = result.current.commandMenu!.renderMenu({
        query: '',
        caretPosition: 0,
        close: vi.fn(),
      }) as ReactElement;
      getOnSelect(menu)({ id: abcSkill.url, name: abcSkill.name });
    });

    act(() => {
      result.current.onDraftChange('/abc please summarize, then run ');
    });

    act(() => {
      const overlay = result.current.skillMenuOverlay!.renderOverlay(
        vi.fn(),
        33,
      ) as ReactElement;
      getOnSelect(overlay)({ id: csdSkill.url, name: csdSkill.name });
    });

    expect(result.current.message).toBe(
      '/abc please summarize, then run /csd ',
    );
    expect(result.current.selectedSkills).toEqual([
      { url: abcSkill.url },
      { url: csdSkill.url },
    ]);
    expect(result.current.activeMentions).toEqual([
      {
        start: 0,
        length: 4,
        isUnsupported: false,
        render: expect.any(Function),
      },
      {
        start: 33,
        length: 4,
        isUnsupported: false,
        render: expect.any(Function),
      },
    ]);
  });

  it('removes a tracked mention via the Backspace lookup + onDraftChange pair', () => {
    const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

    act(() => {
      const menu = result.current.commandMenu!.renderMenu({
        query: '',
        caretPosition: 0,
        close: vi.fn(),
      }) as ReactElement;
      getOnSelect(menu)({ id: abcSkill.url, name: abcSkill.name });
    });

    const found = result.current.onBackspaceAtCaret(4);
    expect(found).toEqual({
      url: abcSkill.url,
      name: abcSkill.name,
      start: 0,
      length: 4,
    });

    act(() => {
      result.current.onDraftChange(' ');
    });

    expect(result.current.activeMentions).toEqual([]);
    expect(result.current.selectedSkills).toBeUndefined();
  });

  it('clears every mention on resetSkillMentions', () => {
    const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

    act(() => {
      const menu = result.current.commandMenu!.renderMenu({
        query: '',
        caretPosition: 0,
        close: vi.fn(),
      }) as ReactElement;
      getOnSelect(menu)({ id: abcSkill.url, name: abcSkill.name });
    });

    act(() => {
      result.current.resetSkillMentions();
    });

    expect(result.current.message).toBe('');
    expect(result.current.activeMentions).toEqual([]);
    expect(result.current.selectedSkills).toBeUndefined();
  });

  it('seeds mentions from a persisted message via seedSkillMentions', () => {
    const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

    act(() => {
      result.current.seedSkillMentions(
        '/abc please summarize this, then run /csd on the result',
        [{ url: abcSkill.url }, { url: csdSkill.url }],
      );
    });

    expect(result.current.activeMentions).toEqual([
      {
        start: 0,
        length: 4,
        isUnsupported: false,
        render: expect.any(Function),
      },
      {
        start: 37,
        length: 4,
        isUnsupported: false,
        render: expect.any(Function),
      },
    ]);
    expect(result.current.selectedSkills).toEqual([
      { url: abcSkill.url },
      { url: csdSkill.url },
    ]);
  });

  it('folds an unsupported deployment into isSkillUnsupported only once a mention exists', () => {
    const { result, rerender } = renderHook(
      (props: UseSkillSelectorOverlayOptions) => useSkillSelectorOverlay(props),
      { initialProps: { ...baseOptions, isSkillsSupported: false } },
    );

    expect(result.current.isSkillUnsupported).toBe(false);

    act(() => {
      result.current.seedSkillMentions('/abc', [{ url: abcSkill.url }]);
    });
    rerender({ ...baseOptions, isSkillsSupported: false });

    expect(result.current.isSkillUnsupported).toBe(true);
    expect(result.current.activeMentions).toEqual([
      {
        start: 0,
        length: 4,
        isUnsupported: true,
        render: expect.any(Function),
      },
    ]);
  });

  it('returns disabled stub outputs while isEnabled is false', () => {
    const { result } = renderHook(() =>
      useSkillSelectorOverlay({ ...baseOptions, isEnabled: false }),
    );

    expect(result.current.skillMenuOverlay).toBeUndefined();
    expect(result.current.commandMenu).toBeUndefined();
    expect(result.current.message).toBe('');
    expect(result.current.activeMentions).toEqual([]);
    expect(result.current.selectedSkills).toBeUndefined();
    expect(result.current.renderHistorySkillSegments('/abc', [])).toBeNull();
    expect(result.current.renderHistorySkills([])).toBeNull();
  });

  describe('renderHistorySkillSegments', () => {
    it('interleaves plain-text runs and ChatSkill elements in order', () => {
      const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

      // Not an RTL `render()` call — the rule pattern-matches on the "render" prefix alone.
      // eslint-disable-next-line testing-library/render-result-naming-convention
      const historySegments = result.current.renderHistorySkillSegments(
        '/abc please summarize this, then run /csd on the result',
        [{ url: abcSkill.url }, { url: csdSkill.url }],
      );

      expect(historySegments).not.toBeNull();
      expect(historySegments).toHaveLength(4);
      expect(historySegments?.[0]).not.toBe(undefined);
      expect(typeof historySegments?.[1]).toBe('string');
      expect(
        (historySegments?.[1] as string).startsWith(' please summarize'),
      ).toBe(true);
      expect(typeof historySegments?.[3]).toBe('string');
    });

    it('returns null for an empty or absent skills array', () => {
      const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

      expect(result.current.renderHistorySkillSegments('hello', [])).toBeNull();
      expect(
        result.current.renderHistorySkillSegments('hello', undefined),
      ).toBeNull();
    });
  });

  describe('renderHistorySkills', () => {
    it('renders every entry as a flat list, ignoring text position', () => {
      const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

      // Not an RTL `render()` call — the rule pattern-matches on the "render" prefix alone.
      // eslint-disable-next-line testing-library/render-result-naming-convention
      const historyChips = result.current.renderHistorySkills([
        { url: abcSkill.url },
        { url: csdSkill.url },
      ]);

      expect(Array.isArray(historyChips)).toBe(true);
      expect((historyChips as ReactElement[]).length).toBe(2);
    });

    it('returns null for an empty or absent skills array', () => {
      const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

      expect(result.current.renderHistorySkills([])).toBeNull();
      expect(result.current.renderHistorySkills(undefined)).toBeNull();
    });
  });
});

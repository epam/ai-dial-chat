import { act, renderHook } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SkillListingEntry } from '../../../models/favorite-skill-item';
import type { UseSkillSelectorOverlayOptions } from '../../../models/skill-selector-overlay';
import { SkillUnresolvedReason } from '../../../types/skill-unresolved-reason';
import { useSkillSelectorOverlay } from '../useSkillSelectorOverlay';

const abcSkill: SkillListingEntry = { url: 'skills/bucket/abc', name: 'abc' };
const csdSkill: SkillListingEntry = { url: 'skills/bucket/csd', name: 'csd' };

const baseOptions: UseSkillSelectorOverlayOptions = {
  isSkillsSupported: true,
  skills: [abcSkill, csdSkill],
  favoriteIds: new Set(),
  viewerBucket: 'bucket',
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

/* Asserts `value` is present and narrows it, in place of a non-null assertion. */
const assertDefined = <T,>(value: T | null | undefined): T => {
  expect(value).toBeDefined();
  return value as T;
};

describe('useSkillSelectorOverlay', () => {
  it('forwards the configured trigger only to active mention chips', () => {
    const { result } = renderHook(() =>
      useSkillSelectorOverlay({
        ...baseOptions,
        activeMentionDetailsTrigger: 'click',
      }),
    );

    act(() => {
      result.current.seedSkillMentions('/abc', [{ url: abcSkill.url }]);
    });

    const activeChip = assertDefined(
      result.current.activeMentions[0].render,
    )() as ReactElement;
    const historyChip = result.current.renderHistorySkills([
      { url: abcSkill.url },
    ]) as ReactElement[];

    expect(activeChip.props).toMatchObject({ detailsTrigger: 'click' });
    expect(historyChip[0].props).not.toHaveProperty('detailsTrigger');
  });

  it('tracks a mention selected via the slash command menu', () => {
    const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

    const close = vi.fn();
    const menu = assertDefined(result.current.commandMenu).renderMenu({
      query: '',
      caretPosition: 0,
      close,
      listboxId: 'skill-menu-listbox',
      activeOptionId: null,
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
      const menu = assertDefined(result.current.commandMenu).renderMenu({
        query: '',
        caretPosition: 0,
        close: vi.fn(),
        listboxId: 'skill-menu-listbox',
        activeOptionId: null,
      }) as ReactElement;
      getOnSelect(menu)({ id: abcSkill.url, name: abcSkill.name });
    });

    act(() => {
      result.current.onDraftChange('/abc please summarize, then run ');
    });

    act(() => {
      const overlay = assertDefined(
        result.current.skillMenuOverlay,
      ).renderOverlay(vi.fn(), 33) as ReactElement;
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
      const menu = assertDefined(result.current.commandMenu).renderMenu({
        query: '',
        caretPosition: 0,
        close: vi.fn(),
        listboxId: 'skill-menu-listbox',
        activeOptionId: null,
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
      const menu = assertDefined(result.current.commandMenu).renderMenu({
        query: '',
        caretPosition: 0,
        close: vi.fn(),
        listboxId: 'skill-menu-listbox',
        activeOptionId: null,
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

  it('omits the entry points while the deployment does not support skills', () => {
    const { result } = renderHook(() =>
      useSkillSelectorOverlay({ ...baseOptions, isSkillsSupported: false }),
    );

    expect(result.current.skillMenuOverlay).toBeUndefined();
    expect(result.current.commandMenu).toBeUndefined();
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

    it("marks an unresolved entry in the viewer's own bucket as deleted", () => {
      const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

      // eslint-disable-next-line testing-library/render-result-naming-convention
      const historySegments = result.current.renderHistorySkillSegments(
        '/gone',
        [{ url: 'skills/bucket/gone' }],
      );

      expect((historySegments?.[0] as ReactElement).props).toMatchObject({
        unresolvedReason: SkillUnresolvedReason.Deleted,
      });
    });

    it('marks an unresolved entry in a foreign bucket as not-shared', () => {
      const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

      // eslint-disable-next-line testing-library/render-result-naming-convention
      const historySegments = result.current.renderHistorySkillSegments(
        '/foreign',
        [{ url: 'skills/other-bucket/foreign' }],
      );

      expect((historySegments?.[0] as ReactElement).props).toMatchObject({
        unresolvedReason: SkillUnresolvedReason.NotShared,
      });
    });

    it('leaves unresolvedReason unset for a resolved entry', () => {
      const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

      // eslint-disable-next-line testing-library/render-result-naming-convention
      const historySegments = result.current.renderHistorySkillSegments(
        '/abc',
        [{ url: abcSkill.url }],
      );

      expect(
        (historySegments?.[0] as ReactElement).props as {
          unresolvedReason?: string;
        },
      ).toHaveProperty('unresolvedReason', undefined);
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

    it("marks an unresolved entry in the viewer's own bucket as deleted", () => {
      const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

      const historyChips = result.current.renderHistorySkills([
        { url: 'skills/bucket/gone' },
      ]) as ReactElement[];

      expect(historyChips[0].props).toMatchObject({
        unresolvedReason: SkillUnresolvedReason.Deleted,
      });
    });

    it('marks an unresolved entry in a foreign bucket as not-shared', () => {
      const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

      const historyChips = result.current.renderHistorySkills([
        { url: 'skills/other-bucket/foreign' },
      ]) as ReactElement[];

      expect(historyChips[0].props).toMatchObject({
        unresolvedReason: SkillUnresolvedReason.NotShared,
      });
    });

    it('leaves unresolvedReason unset for a resolved entry', () => {
      const { result } = renderHook(() => useSkillSelectorOverlay(baseOptions));

      const historyChips = result.current.renderHistorySkills([
        { url: abcSkill.url },
      ]) as ReactElement[];

      expect(
        historyChips[0].props as { unresolvedReason?: string },
      ).toHaveProperty('unresolvedReason', undefined);
    });
  });

  describe('reference stability (issue #9109)', () => {
    it('keeps seedSkillMentions stable across a re-render that does not touch mentions', () => {
      const { result, rerender } = renderHook(
        (props: UseSkillSelectorOverlayOptions) =>
          useSkillSelectorOverlay(props),
        { initialProps: baseOptions },
      );

      const firstSeed = result.current.seedSkillMentions;

      /* Same options, new object identity — mirrors a host re-render caused
         by something unrelated to skills (e.g. a route change). */
      rerender({ ...baseOptions });

      expect(result.current.seedSkillMentions).toBe(firstSeed);
    });
  });
});

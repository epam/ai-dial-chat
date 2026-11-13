import { FilterTab } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  FIRST_GROUP_HEADER_ROW_HEIGHT,
  GROUP_HEADER_ROW_HEIGHT,
  INDICATOR_ITEM_ROW_HEIGHT,
  ITEM_ROW_HEIGHT,
} from '../../constants/virtual-list';
import type { PinnedProjectGroup } from '../../models/pinned-projects';
import type { RowRendererData } from '../../models/virtual-row';
import { ConversationRowVariant } from '../../types/conversation-row-variant';
import { VirtualRowKind } from '../../types/virtual-row';
import {
  buildProjectRows,
  getButtonPaddingEnd,
  getNestedRowProps,
  getOverscanCount,
  getRowHeight,
  getSkeletonWidth,
  isProjectExpanded,
  SKELETON_ROW_COUNT,
} from '../conversation-row';

describe('SKELETON_ROW_COUNT', () => {
  it('is 15', () => {
    expect(SKELETON_ROW_COUNT).toBe(15);
  });
});

describe('getSkeletonWidth', () => {
  it('returns 60% for index 0', () => {
    expect(getSkeletonWidth(0)).toBe('60%');
  });

  it('returns a percentage string for any index', () => {
    for (let i = 0; i < SKELETON_ROW_COUNT; i++) {
      expect(getSkeletonWidth(i)).toMatch(/^\d+%$/);
    }
  });

  it('returns values between 60% and 94%', () => {
    for (let i = 0; i < SKELETON_ROW_COUNT; i++) {
      const value = parseInt(getSkeletonWidth(i));
      expect(value).toBeGreaterThanOrEqual(60);
      expect(value).toBeLessThanOrEqual(94);
    }
  });

  it('produces different widths across rows to create visual variation', () => {
    const widths = Array.from({ length: SKELETON_ROW_COUNT }, (_, i) =>
      getSkeletonWidth(i),
    );
    const unique = new Set(widths);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe('getButtonPaddingEnd', () => {
  it('returns pe-3 for an Avatar row without actions', () => {
    expect(getButtonPaddingEnd(false, false)).toBe('pe-3');
    expect(getButtonPaddingEnd(false, true)).toBe('pe-3');
    expect(
      getButtonPaddingEnd(false, false, ConversationRowVariant.Avatar),
    ).toBe('pe-3');
  });

  it('returns pe-2 for an Indicator row without actions', () => {
    expect(
      getButtonPaddingEnd(false, false, ConversationRowVariant.Indicator),
    ).toBe('pe-2');
  });

  it('keeps the trigger gutter for an Indicator row with actions', () => {
    expect(
      getButtonPaddingEnd(true, true, ConversationRowVariant.Indicator),
    ).toBe('pe-9');
    expect(
      getButtonPaddingEnd(true, false, ConversationRowVariant.Indicator),
    ).toBe(
      'pe-2 group-focus-within/conversation:pe-9 group-hover/conversation:pe-9',
    );
  });

  it('returns pe-9 when actions exist and the menu is open', () => {
    expect(getButtonPaddingEnd(true, true)).toBe('pe-9');
  });

  it('reserves the trigger gutter on hover and on focus-within while idle', () => {
    /* The trigger is painted in both states, so both have to reserve room or it
       lands on top of the truncated title. */
    expect(getButtonPaddingEnd(true, false)).toBe(
      'pe-2 group-focus-within/conversation:pe-9 group-hover/conversation:pe-9',
    );
  });
});

describe('getRowHeight', () => {
  const makeItemRow = (id: string) => ({
    kind: VirtualRowKind.Item as const,
    item: { id, title: id },
    groupKey: FilterTab.MyChats,
  });

  const makeHeaderRow = (key: FilterTab) => ({
    kind: VirtualRowKind.Header as const,
    groupKey: key,
    label: key,
  });

  const makeRowProps = (rows: RowRendererData['rows']): RowRendererData =>
    ({ rows }) as RowRendererData;

  it('returns ITEM_ROW_HEIGHT for an item row at any index', () => {
    const rows = [
      makeHeaderRow(FilterTab.Pinned),
      makeItemRow('a'),
      makeItemRow('b'),
    ];
    const rowProps = makeRowProps(rows);
    expect(getRowHeight(1, rowProps)).toBe(ITEM_ROW_HEIGHT);
    expect(getRowHeight(2, rowProps)).toBe(ITEM_ROW_HEIGHT);
  });

  it('gives a chat nested under a project the Avatar item height only in the Avatar variant', () => {
    const project = {
      id: 'p1',
      name: 'Support',
      conversations: [],
      hasMore: false,
    };
    const rows: RowRendererData['rows'] = [
      {
        kind: VirtualRowKind.ProjectConversation,
        item: { id: 'n1', title: 'n1' },
        projectId: 'p1',
        posInSet: 1,
        setSize: 1,
        isFirstNested: true,
        isLastNested: true,
      },
      { kind: VirtualRowKind.Project, project, isExpanded: true },
    ];

    expect(getRowHeight(0, makeRowProps(rows))).toBe(INDICATOR_ITEM_ROW_HEIGHT);
    expect(
      getRowHeight(0, {
        ...makeRowProps(rows),
        projectConversationVariant: ConversationRowVariant.Avatar,
      }),
    ).toBe(ITEM_ROW_HEIGHT);
    expect(
      getRowHeight(1, {
        ...makeRowProps(rows),
        projectConversationVariant: ConversationRowVariant.Avatar,
      }),
    ).toBe(INDICATOR_ITEM_ROW_HEIGHT);
  });

  it('returns FIRST_GROUP_HEADER_ROW_HEIGHT for a header at index 0', () => {
    const rows = [makeHeaderRow(FilterTab.MyChats), makeItemRow('a')];
    const rowProps = makeRowProps(rows);
    expect(getRowHeight(0, rowProps)).toBe(FIRST_GROUP_HEADER_ROW_HEIGHT);
  });

  it('returns GROUP_HEADER_ROW_HEIGHT for a header at index > 0', () => {
    const rows = [
      makeHeaderRow(FilterTab.Pinned),
      makeItemRow('a'),
      makeHeaderRow(FilterTab.MyChats),
      makeItemRow('b'),
    ];
    const rowProps = makeRowProps(rows);
    expect(getRowHeight(2, rowProps)).toBe(GROUP_HEADER_ROW_HEIGHT);
  });

  it('FIRST_GROUP_HEADER_ROW_HEIGHT is smaller than GROUP_HEADER_ROW_HEIGHT (no top gap for first)', () => {
    expect(FIRST_GROUP_HEADER_ROW_HEIGHT).toBeLessThan(GROUP_HEADER_ROW_HEIGHT);
  });
});

describe('getOverscanCount', () => {
  it('keeps at least five rows for an unmeasured list', () => {
    expect(getOverscanCount(0)).toBe(5);
  });

  it('keeps at least five rows for a list shorter than one row', () => {
    expect(getOverscanCount(ITEM_ROW_HEIGHT - 1)).toBe(5);
  });

  it('overscans half a viewport on each side for a tall list', () => {
    expect(getOverscanCount(900)).toBe(13);
  });
});

describe('getNestedRowProps', () => {
  it('returns the level-2 position and the guide-line classes of a first nested row', () => {
    const props = getNestedRowProps({
      posInSet: 1,
      setSize: 3,
      isFirstNested: true,
      isLastNested: false,
    });

    expect(props['aria-level']).toBe(2);
    expect(props['aria-posinset']).toBe(1);
    expect(props['aria-setsize']).toBe(3);
    expect(props.className).toMatch(/ps-7/);
    expect(props.className).toMatch(/guideLine/);
    expect(props.className).toMatch(/guideLineFirst/);
    expect(props.className).not.toMatch(/guideLineLast/);
  });

  it('marks only the last segment of a last nested row', () => {
    const { className } = getNestedRowProps({
      posInSet: 3,
      setSize: 3,
      isFirstNested: false,
      isLastNested: true,
    });

    expect(className).toMatch(/guideLineLast/);
    expect(className).not.toMatch(/guideLineFirst/);
  });
});

describe('buildProjectRows', () => {
  const project: PinnedProjectGroup = {
    id: 'p1',
    name: 'Support',
    conversations: [
      { id: 'c1', title: 'Weekly summary' },
      { id: 'c2', title: 'Billing reply' },
    ],
    hasMore: true,
  };

  it('returns the project row, its chats and See all while expanded', () => {
    expect(buildProjectRows(project, true).map((row) => row.kind)).toEqual([
      VirtualRowKind.Project,
      VirtualRowKind.ProjectConversation,
      VirtualRowKind.ProjectConversation,
      VirtualRowKind.ProjectSeeAll,
    ]);
  });

  it('expands by default', () => {
    expect(buildProjectRows(project)).toHaveLength(4);
  });

  it('returns only the project row while collapsed', () => {
    const rows = buildProjectRows(project, false);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: VirtualRowKind.Project,
      isExpanded: false,
    });
  });
});

describe('isProjectExpanded', () => {
  const project: PinnedProjectGroup = {
    id: 'p1',
    name: 'Support',
    conversations: [{ id: 'c1', title: 'Billing reply' }],
    hasMore: false,
    isExpanded: false,
  };

  it('treats a project with no isExpanded as expanded', () => {
    expect(isProjectExpanded({ ...project, isExpanded: undefined }, '')).toBe(
      true,
    );
  });

  it('keeps a collapsed project collapsed without a search', () => {
    expect(isProjectExpanded(project, '')).toBe(false);
  });

  it('expands a collapsed project while a search matches one of its chats', () => {
    expect(isProjectExpanded(project, 'billing')).toBe(true);
  });

  it('keeps a collapsed project collapsed when the search matches only its name', () => {
    expect(isProjectExpanded(project, 'support')).toBe(false);
  });
});

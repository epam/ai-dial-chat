import { describe, expect, it } from 'vitest';
import {
  FIRST_GROUP_HEADER_ROW_HEIGHT,
  GROUP_HEADER_ROW_HEIGHT,
  ITEM_ROW_HEIGHT,
} from '../../constants/virtual-list';
import { type RowRendererData, VirtualRowKind } from '../../models/virtual-row';
import { ConversationGroupKey } from '../../types/conversation-group-key';
import {
  getButtonPaddingEnd,
  getRowHeight,
  getSkeletonWidth,
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
  it('returns pe-3 when there are no actions', () => {
    expect(getButtonPaddingEnd(false, false)).toBe('pe-3');
    expect(getButtonPaddingEnd(false, true)).toBe('pe-3');
  });

  it('returns pe-9 when actions exist and the menu is open', () => {
    expect(getButtonPaddingEnd(true, true)).toBe('pe-9');
  });
});

describe('getRowHeight', () => {
  const makeItemRow = (id: string) => ({
    kind: VirtualRowKind.Item as const,
    item: { id, title: id },
    groupKey: ConversationGroupKey.MyChats,
  });

  const makeHeaderRow = (key: ConversationGroupKey) => ({
    kind: VirtualRowKind.Header as const,
    groupKey: key,
    label: key,
  });

  const makeRowProps = (rows: RowRendererData['rows']): RowRendererData =>
    ({ rows }) as RowRendererData;

  it('returns ITEM_ROW_HEIGHT for an item row at any index', () => {
    const rows = [
      makeHeaderRow(ConversationGroupKey.Pinned),
      makeItemRow('a'),
      makeItemRow('b'),
    ];
    const rowProps = makeRowProps(rows);
    expect(getRowHeight(1, rowProps)).toBe(ITEM_ROW_HEIGHT);
    expect(getRowHeight(2, rowProps)).toBe(ITEM_ROW_HEIGHT);
  });

  it('returns FIRST_GROUP_HEADER_ROW_HEIGHT for a header at index 0', () => {
    const rows = [
      makeHeaderRow(ConversationGroupKey.MyChats),
      makeItemRow('a'),
    ];
    const rowProps = makeRowProps(rows);
    expect(getRowHeight(0, rowProps)).toBe(FIRST_GROUP_HEADER_ROW_HEIGHT);
  });

  it('returns GROUP_HEADER_ROW_HEIGHT for a header at index > 0', () => {
    const rows = [
      makeHeaderRow(ConversationGroupKey.Pinned),
      makeItemRow('a'),
      makeHeaderRow(ConversationGroupKey.MyChats),
      makeItemRow('b'),
    ];
    const rowProps = makeRowProps(rows);
    expect(getRowHeight(2, rowProps)).toBe(GROUP_HEADER_ROW_HEIGHT);
  });

  it('FIRST_GROUP_HEADER_ROW_HEIGHT is smaller than GROUP_HEADER_ROW_HEIGHT (no top gap for first)', () => {
    expect(FIRST_GROUP_HEADER_ROW_HEIGHT).toBeLessThan(GROUP_HEADER_ROW_HEIGHT);
  });
});

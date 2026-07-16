import { describe, expect, it } from 'vitest';
import type { ConversationItem } from '../../models/panel-props';
import type { VirtualRow } from '../../models/virtual-row';
import { FilterTab } from '../../types/conversation-classification';
import { VirtualRowKind } from '../../types/virtual-row';
import {
  computeAllowedDropGroups,
  findGroupKeyForItem,
  getDropAfterId,
  sourceToGroupKey,
} from '../drag';

const makeHeader = (groupKey: FilterTab): VirtualRow => ({
  kind: VirtualRowKind.Header,
  groupKey,
  label: groupKey,
});

const makeItem = (id: string, groupKey: FilterTab): VirtualRow => ({
  kind: VirtualRowKind.Item,
  item: { id, title: id },
  groupKey,
});

const makeConversation = (
  id: string,
  source?: FilterTab,
  isPinned?: boolean,
): ConversationItem => ({ id, title: id, source, isPinned });

describe('sourceToGroupKey', () => {
  it('maps Shared source to Shared group', () => {
    expect(sourceToGroupKey(FilterTab.Shared)).toBe(FilterTab.Shared);
  });

  it('maps Organization source to Organization group', () => {
    expect(sourceToGroupKey(FilterTab.Organization)).toBe(
      FilterTab.Organization,
    );
  });

  it('maps MyChats source to MyChats group', () => {
    expect(sourceToGroupKey(FilterTab.MyChats)).toBe(FilterTab.MyChats);
  });

  it('maps undefined source to MyChats group', () => {
    expect(sourceToGroupKey(undefined)).toBe(FilterTab.MyChats);
  });
});

describe('findGroupKeyForItem', () => {
  const rows: VirtualRow[] = [
    makeHeader(FilterTab.Pinned),
    makeItem('pinned-1', FilterTab.Pinned),
    makeHeader(FilterTab.MyChats),
    makeItem('my-1', FilterTab.MyChats),
    makeItem('my-2', FilterTab.MyChats),
    makeHeader(FilterTab.Organization),
    makeItem('org-1', FilterTab.Organization),
  ];

  it('returns the group key of an item in Pinned', () => {
    expect(findGroupKeyForItem(rows, 'pinned-1')).toBe(FilterTab.Pinned);
  });

  it('returns the group key of an item in MyChats', () => {
    expect(findGroupKeyForItem(rows, 'my-1')).toBe(FilterTab.MyChats);
    expect(findGroupKeyForItem(rows, 'my-2')).toBe(FilterTab.MyChats);
  });

  it('returns the group key of an item in Organization', () => {
    expect(findGroupKeyForItem(rows, 'org-1')).toBe(FilterTab.Organization);
  });

  it('returns null when the id is not found', () => {
    expect(findGroupKeyForItem(rows, 'nonexistent')).toBeNull();
  });
});

describe('computeAllowedDropGroups', () => {
  const conversations = [
    makeConversation('my-1', FilterTab.MyChats),
    makeConversation('org-1', FilterTab.Organization),
    makeConversation('pinned-my', FilterTab.MyChats, true),
    makeConversation('pinned-org', FilterTab.Organization, true),
    makeConversation('pinned-no-source', undefined, true),
  ];

  it('always includes the drag source group (reorder within same group)', () => {
    const result = computeAllowedDropGroups(
      'my-1',
      FilterTab.MyChats,
      conversations,
    );
    expect(result.has(FilterTab.MyChats)).toBe(true);
  });

  it('allows Pinned as a target when dragging from MyChats (pin action)', () => {
    const result = computeAllowedDropGroups(
      'my-1',
      FilterTab.MyChats,
      conversations,
    );
    expect(result.has(FilterTab.Pinned)).toBe(true);
  });

  it('allows Pinned as a target when dragging from Organization (pin action)', () => {
    const result = computeAllowedDropGroups(
      'org-1',
      FilterTab.Organization,
      conversations,
    );
    expect(result.has(FilterTab.Pinned)).toBe(true);
  });

  it('does not allow Organization when dragging from MyChats', () => {
    const result = computeAllowedDropGroups(
      'my-1',
      FilterTab.MyChats,
      conversations,
    );
    expect(result.has(FilterTab.Organization)).toBe(false);
  });

  it('does not allow MyChats when dragging from Organization', () => {
    const result = computeAllowedDropGroups(
      'org-1',
      FilterTab.Organization,
      conversations,
    );
    expect(result.has(FilterTab.MyChats)).toBe(false);
  });

  it('allows unpin to MyChats when dragging a pinned MyChats item', () => {
    const result = computeAllowedDropGroups(
      'pinned-my',
      FilterTab.Pinned,
      conversations,
    );
    expect(result.has(FilterTab.MyChats)).toBe(true);
    expect(result.has(FilterTab.Organization)).toBe(false);
  });

  it('allows unpin to Organization when dragging a pinned Organization item', () => {
    const result = computeAllowedDropGroups(
      'pinned-org',
      FilterTab.Pinned,
      conversations,
    );
    expect(result.has(FilterTab.Organization)).toBe(true);
    expect(result.has(FilterTab.MyChats)).toBe(false);
  });

  it('always includes Pinned when dragging from Pinned (reorder within Pinned)', () => {
    const result = computeAllowedDropGroups(
      'pinned-my',
      FilterTab.Pinned,
      conversations,
    );
    expect(result.has(FilterTab.Pinned)).toBe(true);
  });

  it('allows MyChats for pinned item with no source (defaults to MyChats)', () => {
    const result = computeAllowedDropGroups(
      'pinned-no-source',
      FilterTab.Pinned,
      conversations,
    );
    expect(result.has(FilterTab.MyChats)).toBe(true);
  });

  it('returns empty set when draggingGroupKey is null', () => {
    const result = computeAllowedDropGroups('my-1', null, conversations);
    expect(result.size).toBe(1); // Only Pinned (since not dragging from Pinned)
    expect(result.has(FilterTab.Pinned)).toBe(true);
  });
});

describe('getDropAfterId', () => {
  const rows: VirtualRow[] = [
    makeHeader(FilterTab.MyChats),
    makeItem('a', FilterTab.MyChats),
    makeItem('b', FilterTab.MyChats),
    makeItem('c', FilterTab.MyChats),
  ];

  const makeDragEvent = (
    clientY: number,
    rectTop: number,
    rectHeight: number,
  ) => ({
    currentTarget: {
      getBoundingClientRect: () => ({ top: rectTop, height: rectHeight }),
    } as unknown as HTMLElement,
    clientY,
  });

  it('returns the item id when dropping on the bottom half (insert after)', () => {
    // rect: top=0, height=40 → midpoint=20; clientY=30 → bottom half
    const e = makeDragEvent(30, 0, 40);
    expect(getDropAfterId(e, 'b', rows, FilterTab.MyChats)).toBe('b');
  });

  it('returns the preceding item id when dropping on the top half (insert before)', () => {
    // rect: top=0, height=40 → midpoint=20; clientY=10 → top half; preceding 'b' is 'a'
    const e = makeDragEvent(10, 0, 40);
    expect(getDropAfterId(e, 'b', rows, FilterTab.MyChats)).toBe('a');
  });

  it('returns null when dropping on the top half of the first item in a group', () => {
    // Dropping on top half of 'a' (first in group) → insert before 'a' → afterId = null
    const e = makeDragEvent(10, 0, 40);
    expect(getDropAfterId(e, 'a', rows, FilterTab.MyChats)).toBeNull();
  });

  it('returns the correct preceding item for the last item in a group', () => {
    const e = makeDragEvent(10, 0, 40);
    expect(getDropAfterId(e, 'c', rows, FilterTab.MyChats)).toBe('b');
  });
});

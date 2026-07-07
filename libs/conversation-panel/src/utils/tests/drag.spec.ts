import { describe, expect, it } from 'vitest';
import type { ConversationHistoryItem } from '../../models/panel-props';
import type { VirtualRow } from '../../models/virtual-row';
import { ConversationGroupKey } from '../../types/conversation-group-key';
import { ConversationSource } from '../../types/conversation-source';
import { VirtualRowKind } from '../../types/virtual-row';
import {
  computeAllowedDropGroups,
  findGroupKeyForItem,
  getDropAfterId,
  sourceToGroupKey,
} from '../drag';

const makeHeader = (groupKey: ConversationGroupKey): VirtualRow => ({
  kind: VirtualRowKind.Header,
  groupKey,
  label: groupKey,
});

const makeItem = (id: string, groupKey: ConversationGroupKey): VirtualRow => ({
  kind: VirtualRowKind.Item,
  item: { id, title: id },
  groupKey,
});

const makeConversation = (
  id: string,
  source?: ConversationSource,
  isPinned?: boolean,
): ConversationHistoryItem => ({ id, title: id, source, isPinned });

describe('sourceToGroupKey', () => {
  it('maps Shared source to Shared group', () => {
    expect(sourceToGroupKey(ConversationSource.Shared)).toBe(
      ConversationGroupKey.Shared,
    );
  });

  it('maps Organization source to Organization group', () => {
    expect(sourceToGroupKey(ConversationSource.Organization)).toBe(
      ConversationGroupKey.Organization,
    );
  });

  it('maps MyChats source to MyChats group', () => {
    expect(sourceToGroupKey(ConversationSource.MyChats)).toBe(
      ConversationGroupKey.MyChats,
    );
  });

  it('maps undefined source to MyChats group', () => {
    expect(sourceToGroupKey(undefined)).toBe(ConversationGroupKey.MyChats);
  });
});

describe('findGroupKeyForItem', () => {
  const rows: VirtualRow[] = [
    makeHeader(ConversationGroupKey.Pinned),
    makeItem('pinned-1', ConversationGroupKey.Pinned),
    makeHeader(ConversationGroupKey.MyChats),
    makeItem('my-1', ConversationGroupKey.MyChats),
    makeItem('my-2', ConversationGroupKey.MyChats),
    makeHeader(ConversationGroupKey.Organization),
    makeItem('org-1', ConversationGroupKey.Organization),
  ];

  it('returns the group key of an item in Pinned', () => {
    expect(findGroupKeyForItem(rows, 'pinned-1')).toBe(
      ConversationGroupKey.Pinned,
    );
  });

  it('returns the group key of an item in MyChats', () => {
    expect(findGroupKeyForItem(rows, 'my-1')).toBe(
      ConversationGroupKey.MyChats,
    );
    expect(findGroupKeyForItem(rows, 'my-2')).toBe(
      ConversationGroupKey.MyChats,
    );
  });

  it('returns the group key of an item in Organization', () => {
    expect(findGroupKeyForItem(rows, 'org-1')).toBe(
      ConversationGroupKey.Organization,
    );
  });

  it('returns null when the id is not found', () => {
    expect(findGroupKeyForItem(rows, 'nonexistent')).toBeNull();
  });
});

describe('computeAllowedDropGroups', () => {
  const conversations = [
    makeConversation('my-1', ConversationSource.MyChats),
    makeConversation('org-1', ConversationSource.Organization),
    makeConversation('pinned-my', ConversationSource.MyChats, true),
    makeConversation('pinned-org', ConversationSource.Organization, true),
    makeConversation('pinned-no-source', undefined, true),
  ];

  it('always includes the drag source group (reorder within same group)', () => {
    const result = computeAllowedDropGroups(
      'my-1',
      ConversationGroupKey.MyChats,
      conversations,
    );
    expect(result.has(ConversationGroupKey.MyChats)).toBe(true);
  });

  it('allows Pinned as a target when dragging from MyChats (pin action)', () => {
    const result = computeAllowedDropGroups(
      'my-1',
      ConversationGroupKey.MyChats,
      conversations,
    );
    expect(result.has(ConversationGroupKey.Pinned)).toBe(true);
  });

  it('allows Pinned as a target when dragging from Organization (pin action)', () => {
    const result = computeAllowedDropGroups(
      'org-1',
      ConversationGroupKey.Organization,
      conversations,
    );
    expect(result.has(ConversationGroupKey.Pinned)).toBe(true);
  });

  it('does not allow Organization when dragging from MyChats', () => {
    const result = computeAllowedDropGroups(
      'my-1',
      ConversationGroupKey.MyChats,
      conversations,
    );
    expect(result.has(ConversationGroupKey.Organization)).toBe(false);
  });

  it('does not allow MyChats when dragging from Organization', () => {
    const result = computeAllowedDropGroups(
      'org-1',
      ConversationGroupKey.Organization,
      conversations,
    );
    expect(result.has(ConversationGroupKey.MyChats)).toBe(false);
  });

  it('allows unpin to MyChats when dragging a pinned MyChats item', () => {
    const result = computeAllowedDropGroups(
      'pinned-my',
      ConversationGroupKey.Pinned,
      conversations,
    );
    expect(result.has(ConversationGroupKey.MyChats)).toBe(true);
    expect(result.has(ConversationGroupKey.Organization)).toBe(false);
  });

  it('allows unpin to Organization when dragging a pinned Organization item', () => {
    const result = computeAllowedDropGroups(
      'pinned-org',
      ConversationGroupKey.Pinned,
      conversations,
    );
    expect(result.has(ConversationGroupKey.Organization)).toBe(true);
    expect(result.has(ConversationGroupKey.MyChats)).toBe(false);
  });

  it('always includes Pinned when dragging from Pinned (reorder within Pinned)', () => {
    const result = computeAllowedDropGroups(
      'pinned-my',
      ConversationGroupKey.Pinned,
      conversations,
    );
    expect(result.has(ConversationGroupKey.Pinned)).toBe(true);
  });

  it('allows MyChats for pinned item with no source (defaults to MyChats)', () => {
    const result = computeAllowedDropGroups(
      'pinned-no-source',
      ConversationGroupKey.Pinned,
      conversations,
    );
    expect(result.has(ConversationGroupKey.MyChats)).toBe(true);
  });

  it('returns empty set when draggingGroupKey is null', () => {
    const result = computeAllowedDropGroups('my-1', null, conversations);
    expect(result.size).toBe(1); // Only Pinned (since not dragging from Pinned)
    expect(result.has(ConversationGroupKey.Pinned)).toBe(true);
  });
});

describe('getDropAfterId', () => {
  const rows: VirtualRow[] = [
    makeHeader(ConversationGroupKey.MyChats),
    makeItem('a', ConversationGroupKey.MyChats),
    makeItem('b', ConversationGroupKey.MyChats),
    makeItem('c', ConversationGroupKey.MyChats),
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
    expect(getDropAfterId(e, 'b', rows, ConversationGroupKey.MyChats)).toBe(
      'b',
    );
  });

  it('returns the preceding item id when dropping on the top half (insert before)', () => {
    // rect: top=0, height=40 → midpoint=20; clientY=10 → top half; preceding 'b' is 'a'
    const e = makeDragEvent(10, 0, 40);
    expect(getDropAfterId(e, 'b', rows, ConversationGroupKey.MyChats)).toBe(
      'a',
    );
  });

  it('returns null when dropping on the top half of the first item in a group', () => {
    // Dropping on top half of 'a' (first in group) → insert before 'a' → afterId = null
    const e = makeDragEvent(10, 0, 40);
    expect(
      getDropAfterId(e, 'a', rows, ConversationGroupKey.MyChats),
    ).toBeNull();
  });

  it('returns the correct preceding item for the last item in a group', () => {
    const e = makeDragEvent(10, 0, 40);
    expect(getDropAfterId(e, 'c', rows, ConversationGroupKey.MyChats)).toBe(
      'b',
    );
  });
});

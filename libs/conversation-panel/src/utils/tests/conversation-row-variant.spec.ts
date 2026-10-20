import { FilterTab } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  FIRST_GROUP_HEADER_ROW_HEIGHT,
  GROUP_HEADER_ROW_HEIGHT,
  INDICATOR_FIRST_GROUP_HEADER_ROW_HEIGHT,
  INDICATOR_GROUP_HEADER_ROW_HEIGHT,
  INDICATOR_ITEM_ROW_HEIGHT,
  ITEM_ROW_HEIGHT,
} from '../../constants/virtual-list';
import type { RowRendererData, VirtualRow } from '../../models/virtual-row';
import { ConversationRowVariant } from '../../types/conversation-row-variant';
import { VirtualRowKind } from '../../types/virtual-row';
import { getRowHeight } from '../conversation-row';

const rows: VirtualRow[] = [
  { kind: VirtualRowKind.Header, groupKey: FilterTab.Pinned, label: 'Pinned' },
  {
    kind: VirtualRowKind.Item,
    item: { id: 'a', title: 'a' },
    groupKey: FilterTab.Pinned,
  },
  {
    kind: VirtualRowKind.Header,
    groupKey: FilterTab.MyChats,
    label: 'My chats',
  },
];

const propsFor = (rowVariant?: ConversationRowVariant) =>
  ({ rows, rowVariant }) as unknown as RowRendererData;

describe('getRowHeight by row variant', () => {
  it('uses the avatar metrics by default', () => {
    const props = propsFor();

    expect(getRowHeight(0, props)).toBe(FIRST_GROUP_HEADER_ROW_HEIGHT);
    expect(getRowHeight(1, props)).toBe(ITEM_ROW_HEIGHT);
    expect(getRowHeight(2, props)).toBe(GROUP_HEADER_ROW_HEIGHT);
  });

  it('uses the indicator metrics for the Indicator variant', () => {
    const props = propsFor(ConversationRowVariant.Indicator);

    expect(getRowHeight(0, props)).toBe(
      INDICATOR_FIRST_GROUP_HEADER_ROW_HEIGHT,
    );
    expect(getRowHeight(1, props)).toBe(INDICATOR_ITEM_ROW_HEIGHT);
    expect(getRowHeight(2, props)).toBe(INDICATOR_GROUP_HEADER_ROW_HEIGHT);
  });
});

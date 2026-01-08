import { memo, useEffect, useMemo, useState } from 'react';

import { sortByDateAndName } from '@/src/utils/app/conversation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

import { CONVERSATIONS_DATE_SECTIONS } from '@/src/constants/sections';

import { ConversationsRenderer } from './ConversationsRenderer';

import { ConversationInfo, FeatureType } from '@epam/ai-dial-shared';

interface Props {
  conversations: ConversationInfo[];
}
interface AllConversations {
  today: ConversationInfo[];
  yesterday: ConversationInfo[];
  lastSevenDays: ConversationInfo[];
  lastThirtyDays: ConversationInfo[];
  older: ConversationInfo[];
  other: ConversationInfo[];
}
interface SortedBlock {
  conversations: ConversationInfo[];
  name: string;
}
interface SortedConversations {
  today: SortedBlock;
  yesterday: SortedBlock;
  lastSevenDays: SortedBlock;
  lastThirtyDays: SortedBlock;
  lastYear: SortedBlock;
  other: SortedBlock;
}

const ConversationsView = ({ conversations }: Props) => {
  const visibleSidebarItemsCount = useAppSelector((state) =>
    UISelectors.selectVisibleSidebarItems(state, FeatureType.Chat),
  );

  const [sortedConversations, setSortedConversations] =
    useState<SortedConversations>();

  const todayDate = useMemo(() => new Date().setHours(0, 0, 0), []);
  const oneDayMilliseconds = 8.64e7;
  const yesterdayDate = todayDate - oneDayMilliseconds;
  const lastSevenDate = todayDate - oneDayMilliseconds * 6;
  const lastThirtyDate = todayDate - oneDayMilliseconds * 29;

  useEffect(() => {
    const allConversations: AllConversations = {
      today: [],
      yesterday: [],
      lastSevenDays: [],
      lastThirtyDays: [],
      older: [],
      other: [],
    };
    sortByDateAndName(conversations).forEach((conv) => {
      const lastActivityDateNumber = conv.updatedAt;

      if (
        !lastActivityDateNumber ||
        typeof lastActivityDateNumber !== 'number'
      ) {
        allConversations.other.push(conv);
      } else {
        if (lastActivityDateNumber > todayDate) {
          allConversations.today.push(conv);
        }
        if (
          lastActivityDateNumber < todayDate &&
          lastActivityDateNumber >= yesterdayDate
        ) {
          allConversations.yesterday.push(conv);
        }
        if (
          lastActivityDateNumber < yesterdayDate &&
          lastActivityDateNumber >= lastSevenDate
        ) {
          allConversations.lastSevenDays.push(conv);
        }
        if (
          lastActivityDateNumber < lastSevenDate &&
          lastActivityDateNumber >= lastThirtyDate
        ) {
          allConversations.lastThirtyDays.push(conv);
        }
        if (lastActivityDateNumber < lastThirtyDate) {
          allConversations.older.push(conv);
        }
      }
    });

    setSortedConversations({
      today: {
        conversations: allConversations.today,
        name: CONVERSATIONS_DATE_SECTIONS.today,
      },
      yesterday: {
        conversations: allConversations.yesterday,
        name: CONVERSATIONS_DATE_SECTIONS.yesterday,
      },
      lastSevenDays: {
        conversations: allConversations.lastSevenDays,
        name: CONVERSATIONS_DATE_SECTIONS.lastSevenDays,
      },
      lastThirtyDays: {
        conversations: allConversations.lastThirtyDays,
        name: CONVERSATIONS_DATE_SECTIONS.lastThirtyDays,
      },
      lastYear: {
        conversations: allConversations.older,
        name: CONVERSATIONS_DATE_SECTIONS.older,
      },
      other: {
        conversations: allConversations.other,
        name: CONVERSATIONS_DATE_SECTIONS.other,
      },
    });
  }, [conversations, lastSevenDate, lastThirtyDate, todayDate, yesterdayDate]);

  const entriesToDisplay = useMemo(() => {
    if (!sortedConversations) {
      return [];
    }

    if (conversations.length <= visibleSidebarItemsCount) {
      return Object.entries(sortedConversations);
    }

    const result = [];
    let remainingConversations = visibleSidebarItemsCount;

    for (const [key, value] of Object.entries(sortedConversations)) {
      if (remainingConversations <= 0) break;

      const take = Math.min(value.conversations.length, remainingConversations);
      result.push([
        key,
        { ...value, conversations: value.conversations.slice(0, take) },
      ]);
      remainingConversations -= take;
    }

    return result;
  }, [conversations.length, visibleSidebarItemsCount, sortedConversations]);

  return (
    <div className="flex w-full flex-col gap-0.5 py-1" data-qa="conversations">
      {entriesToDisplay.map(([key, value]) => (
        <ConversationsRenderer
          key={key}
          conversations={value.conversations}
          label={value.name}
        />
      ))}
    </div>
  );
};

export const Conversations = memo(ConversationsView);

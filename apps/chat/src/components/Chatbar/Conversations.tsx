import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { compareConversationsByDate } from '@/src/utils/app/conversation';

import { ConversationInfo } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConversationsRenderer } from './ConversationsRenderer';

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

const conversationsDateBlocksNames = {
  today: 'Today',
  yesterday: 'Yesterday',
  lastSevenDays: 'Last 7 days',
  lastThirtyDays: 'Last 30 days',
  older: 'Older',
  other: 'Other',
};

export const Conversations = ({ conversations }: Props) => {
  const [sortedConversations, setSortedConversations] =
    useState<SortedConversations>();

  const { t } = useTranslation(Translation.SideBar);

  const conversationsToDisplay = useMemo(
    () => conversations.filter((conversation) => !conversation.folderId),
    [conversations],
  );

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
    conversationsToDisplay.forEach((conv) => {
      const lastActivityDateNumber = conv.lastActivityDate;
      if (
        !lastActivityDateNumber ||
        typeof lastActivityDateNumber !== 'number'
      ) {
        allConversations.other = allConversations.other.concat(conv);
      } else {
        if (lastActivityDateNumber > todayDate) {
          allConversations.today = allConversations.today.concat(conv);
        }
        if (
          lastActivityDateNumber < todayDate &&
          lastActivityDateNumber >= yesterdayDate
        ) {
          allConversations.yesterday = allConversations.yesterday.concat(conv);
        }
        if (
          lastActivityDateNumber < yesterdayDate &&
          lastActivityDateNumber >= lastSevenDate
        ) {
          allConversations.lastSevenDays =
            allConversations.lastSevenDays.concat(conv);
        }
        if (
          lastActivityDateNumber < lastSevenDate &&
          lastActivityDateNumber >= lastThirtyDate
        ) {
          allConversations.lastThirtyDays =
            allConversations.lastThirtyDays.concat(conv);
        }
        if (lastActivityDateNumber < lastThirtyDate) {
          allConversations.older = allConversations.older.concat(conv);
        }
      }
    });

    setSortedConversations({
      today: {
        conversations: allConversations.today.sort(compareConversationsByDate),
        name: conversationsDateBlocksNames.today,
      },
      yesterday: {
        conversations: allConversations.yesterday.sort(
          compareConversationsByDate,
        ),
        name: conversationsDateBlocksNames.yesterday,
      },
      lastSevenDays: {
        conversations: allConversations.lastSevenDays.sort(
          compareConversationsByDate,
        ),
        name: conversationsDateBlocksNames.lastSevenDays,
      },
      lastThirtyDays: {
        conversations: allConversations.lastThirtyDays.sort(
          compareConversationsByDate,
        ),
        name: conversationsDateBlocksNames.lastThirtyDays,
      },
      lastYear: {
        conversations: allConversations.older.sort(compareConversationsByDate),
        name: conversationsDateBlocksNames.older,
      },
      other: {
        conversations: allConversations.other.reverse(),
        name: conversationsDateBlocksNames.other,
      },
    });
  }, [
    conversationsToDisplay,
    lastSevenDate,
    lastThirtyDate,
    todayDate,
    yesterdayDate,
  ]);

  return (
    <div className="flex w-full flex-col gap-0.5 py-1" data-qa="conversations">
      {sortedConversations &&
        Object.entries(sortedConversations).map(([key, value]) => (
          <ConversationsRenderer
            key={key}
            conversations={value.conversations}
            label={t('{{name}}', { name: value.name })}
          />
        ))}
    </div>
  );
};

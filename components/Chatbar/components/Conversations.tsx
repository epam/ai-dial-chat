import { useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/types/chat';

import { ConversationsRenderer } from './ConversationsRenderer';

interface Props {
  conversations: Conversation[];
}
interface AllConversations {
  today: Conversation[];
  yesterday: Conversation[];
  lastSevenDays: Conversation[];
  lastThirtyDays: Conversation[];
  older: Conversation[];
  other: Conversation[];
}
interface SortedBlock {
  conversations: Conversation[];
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

const sortingConversationsByDate = (
  convA: Conversation,
  convB: Conversation,
) => {
  if (convA.lastActivityDate && convB.lastActivityDate) {
    const dateA = convA.lastActivityDate;
    const dateB = convB.lastActivityDate;
    return dateB - dateA;
  }
  return -1;
};

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

  const { t } = useTranslation('sidebar');

  const conversationsToDisplay = conversations.filter(
    (conversation) => !conversation.folderId,
  );

  const todayDate = new Date().setHours(0, 0, 0);
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
        conversations: allConversations.today.sort(sortingConversationsByDate),
        name: conversationsDateBlocksNames.today,
      },
      yesterday: {
        conversations: allConversations.yesterday.sort(
          sortingConversationsByDate,
        ),
        name: conversationsDateBlocksNames.yesterday,
      },
      lastSevenDays: {
        conversations: allConversations.lastSevenDays.sort(
          sortingConversationsByDate,
        ),
        name: conversationsDateBlocksNames.lastSevenDays,
      },
      lastThirtyDays: {
        conversations: allConversations.lastThirtyDays.sort(
          sortingConversationsByDate,
        ),
        name: conversationsDateBlocksNames.lastThirtyDays,
      },
      lastYear: {
        conversations: allConversations.older.sort(sortingConversationsByDate),
        name: conversationsDateBlocksNames.older,
      },
      other: {
        conversations: allConversations.other.reverse(),
        name: conversationsDateBlocksNames.other,
      },
    });
  }, [conversations]);

  return (
    <div className="flex w-full flex-col gap-1" data-qa="conversations">
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

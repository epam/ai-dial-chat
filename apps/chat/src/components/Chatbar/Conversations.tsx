import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { sortByDateAndName } from '@/src/utils/app/conversation';
import { getConversationRootId } from '@/src/utils/app/id';

import { Translation } from '@/src/types/translation';

import { ConversationsRenderer } from './ConversationsRenderer';

import { ConversationInfo } from '@epam/ai-dial-shared';

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

  const conversationsToDisplay = useMemo(() => {
    const conversationRootId = getConversationRootId();
    return conversations.filter(
      (conversation) => conversation.folderId === conversationRootId, // only my root conversations
    );
  }, [conversations]);

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
    sortByDateAndName(conversationsToDisplay).forEach((conv) => {
      const lastActivityDateNumber = conv.lastActivityDate;
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
        name: conversationsDateBlocksNames.today,
      },
      yesterday: {
        conversations: allConversations.yesterday,
        name: conversationsDateBlocksNames.yesterday,
      },
      lastSevenDays: {
        conversations: allConversations.lastSevenDays,
        name: conversationsDateBlocksNames.lastSevenDays,
      },
      lastThirtyDays: {
        conversations: allConversations.lastThirtyDays,
        name: conversationsDateBlocksNames.lastThirtyDays,
      },
      lastYear: {
        conversations: allConversations.older,
        name: conversationsDateBlocksNames.older,
      },
      other: {
        conversations: allConversations.other,
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

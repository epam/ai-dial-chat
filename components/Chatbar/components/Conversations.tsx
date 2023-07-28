import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Conversation } from '@/types/chat';

import { ConversationComponent } from './Conversation';

interface Props {
  conversations: Conversation[];
}
interface AllConversations {
  today: Conversation[];
  yesterday: Conversation[];
  lastSevenDays: Conversation[];
  lastThirtyDays: Conversation[];
  lastYear: Conversation[];
  other: Conversation[];
}

const sortingConversationsByDate = (
  convA: Conversation,
  convB: Conversation,
) => {
  const dateA = convA.lastActivityDate as unknown as number;
  const dateB = convB.lastActivityDate as unknown as number;
  if (convA.lastActivityDate && convB.lastActivityDate) {
    return dateB - dateA;
  }
  return -1;
};
export const Conversations = ({ conversations }: Props) => {
  const [todayConversations, setTodayConversations] = useState<Conversation[]>(
    [],
  );
  const [yesterdayConversations, setYesterdayConversations] = useState<
    Conversation[]
  >([]);
  const [lastSevenDaysConversations, setLastSevenDaysConversations] = useState<
    Conversation[]
  >([]);
  const [lastThirtyDaysConversations, setLastThirtyDaysConversations] =
    useState<Conversation[]>([]);
  const [lastYearConversations, setLastYearConversations] = useState<
    Conversation[]
  >([]);
  const [otherConversations, setOtherConversations] = useState<Conversation[]>(
    [],
  );

  const { t } = useTranslation('sidebar');

  const conversationsToDisplay = conversations.filter(
    (conversation) => !conversation.folderId,
  );

  const todayDate = new Date().setHours(0, 0, 0);
  const oneDayMilliseconds = 8.64e7;
  const yesterdayDate = todayDate - oneDayMilliseconds;
  const lastSevenDate = todayDate - oneDayMilliseconds * 7;
  const lastThirtyDate = todayDate - oneDayMilliseconds * 30;
  const lastYearDate = todayDate - oneDayMilliseconds * 365;

  useEffect(() => {
    const allConversations: AllConversations = {
      today: [],
      yesterday: [],
      lastSevenDays: [],
      lastThirtyDays: [],
      lastYear: [],
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
        if (
          lastActivityDateNumber < lastThirtyDate &&
          lastActivityDateNumber >= lastYearDate
        ) {
          allConversations.lastYear = allConversations.lastYear.concat(conv);
        }
      }
    });

    setTodayConversations([
      ...allConversations.today.sort(sortingConversationsByDate),
    ]);
    setYesterdayConversations([
      ...allConversations.yesterday.sort(sortingConversationsByDate),
    ]);
    setLastSevenDaysConversations([
      ...allConversations.lastSevenDays.sort(sortingConversationsByDate),
    ]);
    setLastThirtyDaysConversations([
      ...allConversations.lastThirtyDays.sort(sortingConversationsByDate),
    ]);
    setLastYearConversations([
      ...allConversations.lastYear.sort(sortingConversationsByDate),
    ]);
    setOtherConversations([...allConversations.other.reverse()]);
  }, [conversations]);

  return (
    <div className="flex w-full flex-col gap-1">
      {todayConversations.length > 0 && (
        <>
          <div className="ml-2 text-[#7F8792]">{t('Today')}</div>
          {todayConversations.map((conversation) => (
            <ConversationComponent
              key={conversation.id}
              conversation={conversation}
            />
          ))}
        </>
      )}
      {yesterdayConversations.length > 0 && (
        <>
          <div className="ml-2 text-[#7F8792]">{t('Yesterday')}</div>
          {yesterdayConversations.map((conversation) => (
            <ConversationComponent
              key={conversation.id}
              conversation={conversation}
            />
          ))}
        </>
      )}
      {lastSevenDaysConversations.length > 0 && (
        <>
          <div className="ml-2 text-[#7F8792]">{t('Previous 7 Days')}</div>
          {lastSevenDaysConversations.map((conversation) => (
            <ConversationComponent
              key={conversation.id}
              conversation={conversation}
            />
          ))}
        </>
      )}
      {lastThirtyDaysConversations.length > 0 && (
        <>
          <div className="ml-2 text-[#7F8792]">{t('Previous 30 days')}</div>
          {lastThirtyDaysConversations.map((conversation) => (
            <ConversationComponent
              key={conversation.id}
              conversation={conversation}
            />
          ))}
        </>
      )}
      {lastYearConversations.length > 0 && (
        <>
          <div className="ml-2 text-[#7F8792]">{t('Previous Year')}</div>
          {lastYearConversations.map((conversation) => (
            <ConversationComponent
              key={conversation.id}
              conversation={conversation}
            />
          ))}
        </>
      )}
      {otherConversations.length > 0 && (
        <>
          <div className="ml-2 text-[#7F8792]">{t('Other')}</div>
          {otherConversations.map((conversation) => (
            <ConversationComponent
              key={conversation.id}
              conversation={conversation}
            />
          ))}
        </>
      )}
    </div>
  );
};

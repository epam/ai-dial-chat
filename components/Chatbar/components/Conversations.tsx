import { useEffect, useState } from 'react';

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
          allConversations.today = allConversations.today
            .concat(conv)
            .sort(sortingConversationsByDate);
        }
        if (
          lastActivityDateNumber < todayDate &&
          lastActivityDateNumber >= yesterdayDate
        ) {
          allConversations.yesterday = allConversations.yesterday
            .concat(conv)
            .sort(sortingConversationsByDate);
        }
        if (
          lastActivityDateNumber < yesterdayDate &&
          lastActivityDateNumber >= lastSevenDate
        ) {
          allConversations.lastSevenDays = allConversations.lastSevenDays
            .concat(conv)
            .sort(sortingConversationsByDate);
        }
        if (
          lastActivityDateNumber < lastSevenDate &&
          lastActivityDateNumber >= lastThirtyDate
        ) {
          allConversations.lastThirtyDays = allConversations.lastThirtyDays
            .concat(conv)
            .sort(sortingConversationsByDate);
        }
        if (
          lastActivityDateNumber < lastThirtyDate &&
          lastActivityDateNumber >= lastYearDate
        ) {
          allConversations.lastYear = allConversations.lastYear
            .concat(conv)
            .sort(sortingConversationsByDate);
        }
      }
    });

    setTodayConversations([...allConversations.today]);
    setYesterdayConversations([...allConversations.yesterday]);
    setLastSevenDaysConversations([...allConversations.lastSevenDays]);
    setLastThirtyDaysConversations([...allConversations.lastThirtyDays]);
    setLastYearConversations([...allConversations.lastYear]);
    setOtherConversations([...allConversations.other.reverse()]);
  }, [conversations]);

  return (
    <div className="flex w-full flex-col gap-1">
      {todayConversations.length > 0 && (
        <>
          <div className="ml-2 text-[#7F8792]">Today</div>
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
          <div className="ml-2 text-[#7F8792]">Yesterday</div>
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
          <div className="ml-2 text-[#7F8792]">Previous 7 Days</div>
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
          <div className="ml-2 text-[#7F8792]">Previous 30 days</div>
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
          <div className="ml-2 text-[#7F8792]">Previous Year</div>
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
          <div className="ml-2 text-[#7F8792]">Other</div>
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

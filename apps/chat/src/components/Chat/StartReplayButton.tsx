import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import Play from '@/public/images/icons/play.svg';

export const StartReplayButton = () => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  const handleReplayStart = useCallback(() => {
    dispatch(
      ConversationsActions.replayConversations({
        conversationsIds: selectedConversationsIds,
      }),
    );
  }, [selectedConversationsIds, dispatch]);

  return (
    <button
      className="button button-chat hover:border-tertiary"
      onClick={handleReplayStart}
      data-qa="start-replay"
      data-replay-variables
    >
      <Play height={18} width={18} className="shrink-0 text-pr-primary-700" />
      <span>{t('Start replay')}</span>
    </button>
  );
};

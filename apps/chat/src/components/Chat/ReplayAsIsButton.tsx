import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { Replay } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import { NonModelButton } from '../Common/NonModelButton';
import { ReplayAsIsIcon } from './ReplayAsIsIcon';

interface Props {
  conversationId: string;
  replay: Replay;
}

export const ReplayAsIsButton = ({ replay, conversationId }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();
  const handleOnSelectReplayAsIs = useCallback(() => {
    dispatch(
      ConversationsActions.updateConversation({
        id: conversationId,
        values: {
          replay: {
            ...replay,
            replayAsIs: true,
          },
        },
      }),
    );
  }, [conversationId, dispatch, replay]);

  return (
    <NonModelButton
      onClickHandler={handleOnSelectReplayAsIs}
      icon={<ReplayAsIsIcon />}
      buttonLabel={t('chat.common.button.replay_as_is.label')}
      isSelected={replay.replayAsIs}
    />
  );
};

import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Replay } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch } from '@/src/store/hooks';

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

  const asIsButtonClassName = classNames(
    'flex items-center gap-3 rounded border p-3 text-left text-xs',
    {
      'border-blue-500': replay.replayAsIs,
      'border-gray-400 hover:border-gray-800': !replay.replayAsIs,
    },
  );

  return (
    <button className={asIsButtonClassName} onClick={handleOnSelectReplayAsIs}>
      <span className="relative inline-block shrink-0 leading-none">
        <ReplayAsIsIcon />
      </span>
      <div className="flex flex-col gap-1">
        <span>{t('Replay as is')}</span>
      </div>
    </button>
  );
};

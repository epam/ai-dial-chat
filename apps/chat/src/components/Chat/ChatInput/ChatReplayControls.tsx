import { IconPlayerPlay, IconRefresh } from '@tabler/icons-react';
import { FC, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import Tooltip from '@/src/components/Common/Tooltip';

import Play from '../../../../public/images/icons/play.svg';
import RefreshCW from '../../../../public/images/icons/refresh-cw.svg';

interface Props {
  showReplayControls: boolean;
  tooltip: string;
  onRegenerate: () => void;
  isErrorButton: boolean;
}

export const ChatReplayControls: FC<Props> = ({
  showReplayControls,
  isErrorButton,
  onRegenerate,
  tooltip,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const isError = useAppSelector(
    ConversationsSelectors.selectIsErrorReplayConversations,
  );
  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  const handleReplayReStart = useCallback(() => {
    dispatch(
      ConversationsActions.replayConversations({
        conversationsIds: selectedConversationsIds,
        isRestart: true,
      }),
    );
  }, [dispatch, selectedConversationsIds]);

  if (!showReplayControls) {
    return (
      <button
        className={classNames(
          'absolute top-[calc(50%_-_12px)] rounded hover:text-accent-primary',
          isOverlay ? 'right-3' : 'right-4',
          isErrorButton && 'text-error',
        )}
        onClick={onRegenerate}
        data-qa="regenerate"
      >
        <Tooltip tooltip={tooltip} isTriggerClickable>
          <IconRefresh size={24} stroke="1.5" />
        </Tooltip>
      </button>
    );
  }

  const Icon = isError ? RefreshCW : IconPlayerPlay;

  return (
    <button
      className={classNames(
        'absolute top-[calc(50%_-_12px)]',
        isOverlay ? 'right-3' : 'right-4',
      )}
      onClick={handleReplayReStart}
      data-qa="proceed-reply"
    >
      <Tooltip
        tooltip={isError ? t('Try again') : t('Continue replay')}
        isTriggerClickable
      >
        <Icon
          height={24}
          width={24}
          className="shrink-0 text-secondary hover:text-accent-primary"
        />
      </Tooltip>
    </button>
  );
};

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
      className="button button-chat"
      onClick={handleReplayStart}
      data-qa="start-replay"
    >
      <Play height={18} width={18} className="shrink-0 text-secondary" />
      <span>{t('Start replay')}</span>
    </button>
  );
};

import { IconPlayerPlay } from '@tabler/icons-react';
import { FC, useCallback } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { SendMessageButton } from '@/src/components/Chat/ChatInput/SendMessageButton';
import { Tooltip } from '@/src/components/Common/Tooltip';

import RefreshCW from '@/public/images/icons/refresh-cw.svg';
import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  showReplayControls: boolean;
  tooltip: string;
  onSend: () => void;
  isLastMessageError: boolean;
  isSendDisabled: boolean;
  isLoading: boolean;
}

export const ChatControls: FC<Props> = ({
  showReplayControls,
  isLastMessageError,
  onSend,
  isSendDisabled,
  isLoading,
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
  const willReplayRequireVariables = useAppSelector(
    ConversationsSelectors.selectWillReplayRequireVariables,
  );

  const handleReplayReStart = useCallback(() => {
    dispatch(
      ConversationsActions.replayConversations({
        conversationsIds: selectedConversationsIds,
        isRestart: !willReplayRequireVariables,
        isContinue: willReplayRequireVariables,
      }),
    );
  }, [dispatch, selectedConversationsIds, willReplayRequireVariables]);

  if (!showReplayControls) {
    return (
      <SendMessageButton
        isLastMessageError={isLastMessageError}
        onSend={onSend}
        isDisabled={isSendDisabled}
        tooltip={tooltip}
        isLoading={isLoading}
      />
    );
  }

  const Icon = isError ? RefreshCW : IconPlayerPlay;

  return (
    <DialButton
      className={classNames(
        'absolute bottom-3',
        isOverlay ? 'right-3' : 'right-4',
      )}
      onClick={handleReplayReStart}
      data-qa="proceed-reply"
      data-replay-variables
      iconBefore={
        <Tooltip
          tooltip={isError ? t('Try again') : t('Continue replay')}
          isTriggerClickable
        >
          <Icon
            height={24}
            width={24}
            className={classNames(
              'shrink-0 hover:text-accent-primary',
              isError ? 'text-error' : 'text-secondary',
            )}
          />
        </Tooltip>
      }
    />
  );
};

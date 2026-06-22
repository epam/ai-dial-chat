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

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { SendMessageButton } from '@/src/components/Chat/ChatInput/SendMessageButton';

import RefreshCW from '@/public/images/icons/refresh-cw.svg';
import { DialIconButton } from '@epam/ai-dial-ui-kit';

interface Props {
  showReplayControls: boolean;
  tooltip: string;
  onSend: () => void;
  isLastMessageError: boolean;
  isSendDisabled: boolean;
  isLoading: boolean;
  microphoneButtonHidden?: boolean;
}

export const ChatControls: FC<Props> = ({
  showReplayControls,
  isLastMessageError,
  onSend,
  isSendDisabled,
  isLoading,
  tooltip,
  microphoneButtonHidden,
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
        microphoneButtonHidden={microphoneButtonHidden}
      />
    );
  }

  const Icon = isError ? RefreshCW : IconPlayerPlay;

  return (
    <DialIconButton
      className="size-[20px] p-0"
      tooltipProps={{
        tooltip: isError
          ? t(ChatI18nKeys.TryAgain)
          : t(ChatI18nKeys.ContinueReplay),
        isTriggerClickable: true,
        triggerClassName: classNames(
          'absolute size-[20px]',
          isOverlay ? 'bottom-2 end-3' : 'end-4 top-3 md:bottom-3',
        ),
      }}
      onClick={handleReplayReStart}
      data-qa="proceed-reply"
      data-replay-variables
      icon={
        <Icon
          height={DEFAULT_ICON_SIZES.STANDARD}
          width={DEFAULT_ICON_SIZES.STANDARD}
          className={classNames(
            'shrink-0 hover:text-accent-primary',
            isError ? 'text-error' : 'text-secondary',
          )}
        />
      }
    />
  );
};

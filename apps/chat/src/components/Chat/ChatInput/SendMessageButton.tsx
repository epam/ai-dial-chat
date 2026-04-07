import {
  IconPlaystationSquare,
  IconRefresh,
  IconSend,
} from '@tabler/icons-react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  ModelsSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { Spinner } from '@/src/components/Common/Spinner';

import { Inversify } from '@epam/ai-dial-modulify-ui';
import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  onSend: () => void;
  isDisabled: boolean;
  isLastMessageError: boolean;
  tooltip?: string;
  isLoading?: boolean;
}

export const SendMessageButton = Inversify.register(
  'SendMessageButton',
  ({ isLastMessageError, onSend, isDisabled, tooltip, isLoading }: Props) => {
    const { t } = useTranslation(Translation.Chat);

    const areModelsLoading = useAppSelector(
      ModelsSelectors.selectAreModelsLoading,
    );
    const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

    const messageIsStreaming = useAppSelector(
      ConversationsSelectors.selectIsConversationsStreaming,
    );

    const isLastAssistantMessageEmpty = useAppSelector(
      ConversationsSelectors.selectIsLastAssistantMessageEmpty,
    );

    if (
      isLastMessageError ||
      (isLastAssistantMessageEmpty && !messageIsStreaming)
    ) {
      return (
        <DialButton
          className={classNames(
            'absolute max-h-[24px] !px-0 hover:text-accent-primary',
            isLastMessageError && 'text-error',
            isOverlay ? 'bottom-2 right-3' : 'bottom-2.5 right-4 md:bottom-3',
          )}
          aria-label={t(ChatI18nKeys.SendAMessage)}
          onClick={onSend}
          data-qa="regenerate"
          tooltipProps={{ tooltip: tooltip, isTriggerClickable: true }}
          iconBefore={
            <IconRefresh size={DEFAULT_ICON_SIZES.STANDARD} stroke="1.5" />
          }
        />
      );
    }

    const isSpinner = isLoading || areModelsLoading;
    const [Icon, dataQa, disabled] = messageIsStreaming
      ? [IconPlaystationSquare, 'stop-generating', false]
      : [IconSend, 'send', isDisabled];

    return (
      <DialButton
        className={classNames(
          'absolute max-h-[24px] !px-0 hover:text-accent-primary disabled:text-controls-disable',
          isOverlay ? 'bottom-2 right-3' : 'bottom-2.5 right-4 md:bottom-3',
        )}
        onClick={onSend}
        disabled={disabled}
        data-qa={dataQa}
        aria-label={t(ChatI18nKeys.SendAMessage)}
        tooltipProps={{
          hideTooltip: !disabled && !messageIsStreaming,
          tooltip,
          isTriggerClickable: true,
        }}
        iconBefore={
          isSpinner ? (
            <Spinner size={20} />
          ) : (
            <Icon size={DEFAULT_ICON_SIZES.STANDARD} stroke="1.5" />
          )
        }
      />
    );
  },
);

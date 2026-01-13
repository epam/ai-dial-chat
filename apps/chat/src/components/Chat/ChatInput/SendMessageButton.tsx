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

import { Spinner } from '@/src/components/Common/Spinner';
import { Tooltip } from '@/src/components/Common/Tooltip';

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
            'absolute bottom-3 hover:text-accent-primary',
            isLastMessageError && 'text-error',
            isOverlay ? 'right-3' : 'right-4',
          )}
          aria-label={t('Send a message')}
          onClick={onSend}
          data-qa="regenerate"
          iconBefore={
            <Tooltip tooltip={tooltip} isTriggerClickable>
              <IconRefresh size={24} stroke="1.5" />
            </Tooltip>
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
          'absolute bottom-3 hover:text-accent-primary disabled:text-secondary',
          isOverlay ? 'right-3' : 'right-4',
        )}
        onClick={onSend}
        disabled={disabled}
        data-qa={dataQa}
        aria-label={t('Send a message')}
        iconBefore={
          <Tooltip
            hideTooltip={!disabled && !messageIsStreaming}
            tooltip={tooltip}
            isTriggerClickable
          >
            {isSpinner ? (
              <Spinner size={20} />
            ) : (
              <Icon size={24} stroke="1.5" />
            )}
          </Tooltip>
        }
      />
    );
  },
);

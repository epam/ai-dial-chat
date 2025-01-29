import {
  IconPlaystationSquare,
  IconRefresh,
  IconSend,
} from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import Tooltip from '@/src/components/Common/Tooltip';

import { Spinner } from '../../Common/Spinner';

import { Inversify } from '@epam/ai-dial-modulify-ui';

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

    const isModelsLoading = useAppSelector(
      ModelsSelectors.selectModelsIsLoading,
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
        <button
          className={classNames(
            'absolute top-[calc(50%_-_12px)] rounded hover:text-accent-primary',
            isLastMessageError && 'text-error',
            isOverlay ? 'right-3' : 'right-4',
          )}
          aria-label={`${t('Send a message')}`}
          onClick={onSend}
          data-qa="regenerate"
        >
          <Tooltip tooltip={tooltip} isTriggerClickable>
            <IconRefresh size={24} stroke="1.5" />
          </Tooltip>
        </button>
      );
    }

    const isSpinner = isLoading || isModelsLoading;
    const [Icon, dataQa, disabled] = messageIsStreaming
      ? [IconPlaystationSquare, 'stop-generating', false]
      : [IconSend, 'send', isDisabled];

    return (
      <button
        className={classNames(
          'absolute top-[calc(50%_-_12px)] rounded hover:text-accent-primary disabled:cursor-not-allowed disabled:text-secondary',
          isOverlay ? 'right-3' : 'right-4',
        )}
        aria-label={`${t('Send a message')}`}
        onClick={onSend}
        disabled={disabled}
        data-qa={dataQa}
      >
        <Tooltip
          hideTooltip={!disabled && !messageIsStreaming}
          tooltip={tooltip}
          isTriggerClickable
        >
          {isSpinner ? <Spinner size={20} /> : <Icon size={24} stroke="1.5" />}
        </Tooltip>
      </button>
    );
  },
);

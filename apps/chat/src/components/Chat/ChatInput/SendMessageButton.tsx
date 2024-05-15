import {
  IconPlaystationSquare,
  IconRefresh,
  IconSend,
} from '@tabler/icons-react';

import classNames from 'classnames';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import Tooltip from '@/src/components/Common/Tooltip';

import { Spinner } from '../../Common/Spinner';

interface Props {
  onSend: () => void;
  isDisabled: boolean;
  isLastMessageError: boolean;
  tooltip?: string;
  isLoading?: boolean;
}

export const SendMessageButton = ({
  isLastMessageError,
  onSend,
  isDisabled,
  tooltip,
  isLoading,
}: Props) => {
  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  if (isLastMessageError) {
    return (
      <button
        className={classNames(
          'absolute top-[calc(50%_-_12px)] rounded text-error hover:text-accent-primary',
          isOverlay ? 'right-3' : 'right-4',
        )}
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
        'absolute top-[calc(50%_-_12px)] rounded hover:text-accent-primary disabled:cursor-not-allowed disabled:text-secondary-bg-dark',
        isOverlay ? 'right-3' : 'right-4',
      )}
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
};

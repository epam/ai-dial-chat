import { IconSend } from '@tabler/icons-react';

import classNames from 'classnames';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import Tooltip from '@/src/components/Common/Tooltip';

import { Spinner } from '../../Common/Spinner';

interface Props {
  handleSend: () => void;
  isDisabled: boolean;
  tooltip?: string;
  isLoading?: boolean;
}

export const SendMessageButton = ({
  handleSend,
  isDisabled,
  tooltip,
  isLoading,
}: Props) => {
  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  return (
    <button
      className={classNames(
        'absolute top-[calc(50%_-_12px)] rounded hover:text-accent-primary disabled:cursor-not-allowed disabled:text-secondary',
        isOverlay ? 'right-3' : 'right-4',
      )}
      onClick={handleSend}
      disabled={isDisabled}
      data-qa="send"
    >
      <Tooltip hideTooltip={!isDisabled} tooltip={tooltip}>
        {messageIsStreaming || isModelsLoading || isLoading ? (
          <Spinner size={20} />
        ) : (
          <IconSend size={24} stroke="1.5" />
        )}
      </Tooltip>
    </button>
  );
};

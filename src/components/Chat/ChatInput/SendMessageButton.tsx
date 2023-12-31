import { IconSend } from '@tabler/icons-react';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import Tooltip from '@/src/components/Common/Tooltip';

import { Spinner } from '../../Common/Spinner';

interface Props {
  handleSend: () => void;
  isDisabled: boolean;
  tooltip?: string;
}

export const SendMessageButton = ({
  handleSend,
  isDisabled,
  tooltip,
}: Props) => {
  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);

  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  return (
    <button
      className="absolute right-4 top-[calc(50%_-_12px)] rounded hover:text-accent-primary disabled:cursor-not-allowed disabled:text-secondary"
      onClick={handleSend}
      disabled={isDisabled}
      data-qa="send"
    >
      <Tooltip hideTooltip={!isDisabled} tooltip={tooltip}>
        {messageIsStreaming || isModelsLoading ? (
          <Spinner size={20} />
        ) : (
          <IconSend size={24} stroke="1.5" />
        )}
      </Tooltip>
    </button>
  );
};

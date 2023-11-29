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
      className="absolute right-4 top-[calc(50%_-_12px)] rounded hover:text-blue-500 disabled:cursor-not-allowed disabled:text-gray-400 disabled:dark:text-gray-600"
      onClick={handleSend}
      disabled={isDisabled}
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

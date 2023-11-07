import { IconSend } from '@tabler/icons-react';

import classNames from 'classnames';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

interface Props {
  messageIsStreaming: boolean;
  handleSend: () => void;
}

export const SendMessageButton = ({
  handleSend,
  messageIsStreaming,
}: Props) => {
  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const isMessageError = useAppSelector(
    ConversationsSelectors.selectIsMessagesError,
  );
  const isLastAssistantMessageEmpty = useAppSelector(
    ConversationsSelectors.selectIsLastAssistantMessageEmpty,
  );
  const isNotModelTypeModelInSelectedConversations = useAppSelector(
    ConversationsSelectors.selectIsNotModelTypeModelInSelectedConversations,
  );

  const isSendDisabled =
    isMessageError &&
    (isLastAssistantMessageEmpty || isNotModelTypeModelInSelectedConversations);

  return (
    <button
      className="absolute right-4 top-2.5 rounded disabled:cursor-not-allowed"
      onClick={handleSend}
      disabled={messageIsStreaming || isModelsLoading || isSendDisabled}
    >
      {messageIsStreaming || isModelsLoading ? (
        <div
          className="h-5 w-5 animate-spin rounded-full border-t-2 border-gray-500"
          data-qa="message-input-spinner"
        ></div>
      ) : (
        <span
          className={classNames(
            isSendDisabled ? 'text-gray-600' : 'hover:text-blue-500',
          )}
        >
          <IconSend size={24} stroke="1.5" />
        </span>
      )}
    </button>
  );
};

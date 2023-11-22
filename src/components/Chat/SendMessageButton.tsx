import { IconSend } from '@tabler/icons-react';
import { ReactNode } from 'react';

import { useTranslation } from 'next-i18next';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';

interface Props {
  handleSend: () => void;
  isInputEmpty: boolean;
}

interface SendIconTooltipProps {
  isShowTooltip?: boolean;
  tooltipContent?: string;
  children: ReactNode;
}

const SendIconTooltip = ({
  isShowTooltip,
  tooltipContent,
  children,
}: SendIconTooltipProps) => {
  return (
    <>
      {!isShowTooltip ? (
        children
      ) : (
        <Tooltip>
          <TooltipTrigger>{children}</TooltipTrigger>
          {tooltipContent && <TooltipContent>{tooltipContent}</TooltipContent>}
        </Tooltip>
      )}
    </>
  );
};

export const SendMessageButton = ({ handleSend, isInputEmpty }: Props) => {
  const { t } = useTranslation('chat');
  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const isMessageError = useAppSelector(
    ConversationsSelectors.selectIsMessagesError,
  );
  const isLastAssistantMessageEmpty = useAppSelector(
    ConversationsSelectors.selectIsLastAssistantMessageEmpty,
  );
  const notModelConversations = useAppSelector(
    ConversationsSelectors.selectNotModelConversations,
  );
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );

  const isError =
    isLastAssistantMessageEmpty || (isMessageError && notModelConversations);

  const tooltipContent = (): string => {
    if (isReplay) {
      return t('Please continue replay to continue working with chat');
    }
    if (isError) {
      return t('Please regenerate response to continue working with chat');
    }
    return t('Please type a message');
  };

  const isShowDisabled = isError || isInputEmpty || isReplay;

  return (
    <button
      className="absolute right-4 top-2.5 rounded hover:text-blue-500 disabled:cursor-not-allowed disabled:text-gray-400 disabled:dark:text-gray-600"
      onClick={handleSend}
      disabled={messageIsStreaming || isModelsLoading || isShowDisabled}
    >
      {messageIsStreaming || isModelsLoading ? (
        <div
          className="h-5 w-5 animate-spin rounded-full border-t-2 border-gray-500"
          data-qa="message-input-spinner"
        ></div>
      ) : (
        <SendIconTooltip
          isShowTooltip={isShowDisabled}
          tooltipContent={tooltipContent()}
        >
          <IconSend size={24} stroke="1.5" />
        </SendIconTooltip>
      )}
    </button>
  );
};

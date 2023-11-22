import { IconSend } from '@tabler/icons-react';
import { ReactNode } from 'react';

import { useTranslation } from 'next-i18next';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/src/components/Common/Tooltip';

import { Spinner } from '../../Common/Spinner';

interface Props {
  handleSend: () => void;
  isInputEmpty: boolean;
}

interface SendIconTooltipProps {
  isShowTooltip?: boolean;
  isError?: boolean;
  children: ReactNode;
}

const SendIconTooltip = ({
  isShowTooltip,
  isError,
  children,
}: SendIconTooltipProps) => {
  const { t } = useTranslation('chat');

  const tooltipContent = isError
    ? 'Please regenerate response to continue working with chat'
    : 'Please type a message';
  return (
    <>
      {!isShowTooltip ? (
        children
      ) : (
        <Tooltip>
          <TooltipTrigger>{children}</TooltipTrigger>
          <TooltipContent>{t(tooltipContent)}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
};

export const SendMessageButton = ({ handleSend, isInputEmpty }: Props) => {
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

  const isError =
    isLastAssistantMessageEmpty || (isMessageError && notModelConversations);

  return (
    <button
      className="absolute right-4 top-[calc(50%_-_12px)] rounded hover:text-blue-500 disabled:cursor-not-allowed disabled:text-gray-400 disabled:dark:text-gray-600"
      onClick={handleSend}
      disabled={
        messageIsStreaming || isModelsLoading || isError || isInputEmpty
      }
    >
      {messageIsStreaming || isModelsLoading ? (
        <Spinner size={20} />
      ) : (
        <SendIconTooltip
          isShowTooltip={isError || isInputEmpty}
          isError={isError}
        >
          <IconSend size={24} stroke="1.5" />
        </SendIconTooltip>
      )}
    </button>
  );
};

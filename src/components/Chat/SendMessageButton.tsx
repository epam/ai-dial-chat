import { IconSend } from '@tabler/icons-react';
import { ReactNode } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';

interface Props {
  handleSend: () => void;
}

interface SendIconComponentProps {
  isSendDisabled?: boolean;
}

interface SendIconTooltipProps {
  isSendDisabled?: boolean;
  children: ReactNode;
}

const SendIconComponent = ({ isSendDisabled }: SendIconComponentProps) => (
  <span
    className={classNames(
      isSendDisabled
        ? 'text-gray-400 dark:text-gray-600'
        : 'hover:text-blue-500',
    )}
  >
    <IconSend size={24} stroke="1.5" />
  </span>
);

const SendIconTooltip = ({
  isSendDisabled,
  children,
}: SendIconTooltipProps) => {
  const { t } = useTranslation('chat');

  return (
    <>
      {!isSendDisabled ? (
        children
      ) : (
        <Tooltip>
          <TooltipTrigger>{children}</TooltipTrigger>
          <TooltipContent>
            {t('Please regenerate response to continue working with chat')}
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
};

export const SendMessageButton = ({ handleSend }: Props) => {
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

  const isSendDisabled =
    isLastAssistantMessageEmpty || (isMessageError && notModelConversations);

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
        <SendIconTooltip isSendDisabled={isSendDisabled}>
          <SendIconComponent isSendDisabled={isSendDisabled} />
        </SendIconTooltip>
      )}
    </button>
  );
};

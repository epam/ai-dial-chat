import { IconClearAll, IconSettings, IconX } from '@tabler/icons-react';
import { useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/types/chat';
import { OpenAIModel, OpenAIModelID } from '@/types/openai';

import { ModelSelect } from './ModelSelect';

interface Props {
  conversation: Conversation;
  models: OpenAIModel[];
  defaultModelId: OpenAIModelID;
  isCompareMode: boolean;
  selectedCinversationIds: string[];
  onSelectModel: (modelId: string) => void;
  onClearConversation: () => void;
  onUnselectConversation: () => void;
}

export const ChatSettings = ({
  conversation,
  models,
  defaultModelId,
  isCompareMode,
  selectedCinversationIds,
  onSelectModel,
  onClearConversation,
  onUnselectConversation,
}: Props) => {
  const { t } = useTranslation('chat');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  return (
    <>
      <div className="sticky top-0 z-10 flex justify-center border border-b-neutral-300 bg-neutral-100 py-2 text-sm text-neutral-500 dark:border-none dark:bg-[#444654] dark:text-neutral-200">
        {isCompareMode && (
          <>
            {t('Name')}:&nbsp;
            <span
              className="max-w-[50px] text-ellipsis whitespace-nowrap overflow-hidden"
              title={conversation.name}
            >
              {conversation.name}
            </span>
            &nbsp;|{' '}
          </>
        )}
        {t('Model')}: {conversation.model.name} | {t('Temp')}:{' '}
        {conversation.temperature} |
        <button
          className="ml-2 cursor-pointer hover:opacity-50"
          onClick={() => {
            setShowSettings(!showSettings);
          }}
        >
          <IconSettings size={18} />
        </button>
        <button
          className="ml-2 cursor-pointer hover:opacity-50"
          onClick={onClearConversation}
        >
          <IconClearAll size={18} />
        </button>
        {isCompareMode && selectedCinversationIds.length > 1 && (
          <button
            className="ml-2 cursor-pointer hover:opacity-50"
            onClick={onUnselectConversation}
          >
            <IconX size={18} />
          </button>
        )}
      </div>
      {showSettings && (
        <div className="flex flex-col space-y-10 md:mx-auto md:max-w-xl md:gap-6 md:py-3 md:pt-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
          <div className="flex h-full flex-col space-y-4 border-b border-neutral-200 p-4 dark:border-neutral-600 md:rounded-lg md:border">
            <ModelSelect
              conversationModelId={conversation.model.id}
              defaultModelId={defaultModelId}
              models={models}
              onSelectModel={onSelectModel}
            />
          </div>
        </div>
      )}
    </>
  );
};

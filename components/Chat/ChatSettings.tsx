import { IconClearAll, IconSettings, IconX } from '@tabler/icons-react';
import { useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/types/chat';
import {
  OpenAIEntityAddon,
  OpenAIEntityModel,
  OpenAIEntityModelID,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { ConversationSettings } from './ConversationSettings';

interface Props {
  conversation: Conversation;
  models: OpenAIEntityModel[];
  addons: OpenAIEntityAddon[];
  prompts: Prompt[];
  defaultModelId: OpenAIEntityModelID;
  isCompareMode: boolean;
  selectedConversationIds: string[];
  messageIsStreaming: boolean;
  isShowChatInfo: boolean;
  isShowModelSelect: boolean;
  isShowClearConversation: boolean;
  isIframe: boolean;
  onSelectModel: (modelId: string) => void;
  onClearConversation: () => void;
  onUnselectConversation: () => void;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
  onChangeAddon: (addonId: string) => void;
}

export const ChatSettings = ({
  conversation,
  models,
  addons,
  defaultModelId,
  isCompareMode,
  selectedConversationIds,
  messageIsStreaming,
  isShowChatInfo,
  isShowModelSelect,
  isShowClearConversation,
  isIframe,
  prompts,
  onSelectModel,
  onClearConversation,
  onUnselectConversation,
  onChangePrompt,
  onChangeTemperature,
  onSelectAssistantSubModel,
  onChangeAddon,
}: Props) => {
  const { t } = useTranslation('chat');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  return (
    <>
      <div className="sticky top-0 z-10 flex justify-center border border-b-neutral-300 bg-neutral-100 py-2 text-sm text-neutral-500 dark:border-none dark:bg-[#444654] dark:text-neutral-200">
        {isShowChatInfo && (
          <>
            {isCompareMode && (
              <>
                {t('Name')}:&nbsp;
                <span
                  className="max-w-[50px] lg:max-w-[300px] text-ellipsis whitespace-nowrap overflow-hidden"
                  title={conversation.name}
                >
                  {conversation.name}
                </span>
                &nbsp;|{' '}
              </>
            )}

            <span>
              {t('Model')}: {conversation.model.name} |{' '}
              {!isIframe && (
                <>
                  {t('Temp')}: {conversation.temperature} |
                </>
              )}
            </span>
          </>
        )}
        {isShowModelSelect && (
          <button
            className="ml-2 cursor-pointer hover:opacity-50"
            onClick={() => {
              setShowSettings(!showSettings);
            }}
          >
            <IconSettings size={18} />
          </button>
        )}
        {isShowClearConversation && !isCompareMode && (
          <button
            className="ml-2 cursor-pointer hover:opacity-50"
            onClick={onClearConversation}
          >
            <IconClearAll size={18} />
          </button>
        )}
        {isCompareMode && selectedConversationIds.length > 1 && (
          <button
            className="ml-2 cursor-pointer hover:opacity-50 disabled:cursor-not-allowed"
            onClick={onUnselectConversation}
            disabled={messageIsStreaming}
          >
            <IconX size={18} />
          </button>
        )}
      </div>
      {showSettings && (
        <div className="flex flex-col space-y-10 md:mx-auto md:max-w-xl md:gap-6 md:py-3 md:pt-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
          <ConversationSettings
            conversation={conversation}
            defaultModelId={defaultModelId}
            models={models}
            prompts={prompts}
            addons={addons}
            onSelectModel={onSelectModel}
            onChangePrompt={onChangePrompt}
            onChangeTemperature={onChangeTemperature}
            onSelectAssistantSubModel={onSelectAssistantSubModel}
            onChangeAddon={onChangeAddon}
          />
        </div>
      )}
    </>
  );
};

import { IconClearAll, IconSettings, IconX } from '@tabler/icons-react';
import { useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/types/chat';
import { ModelIconMappingType } from '@/types/icons';
import {
  OpenAIEntityAddon,
  OpenAIEntityModel,
  OpenAIEntityModelID,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

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
  isShowSettings: boolean;
  modelIconMapping: ModelIconMappingType;
  onSelectModel: (modelId: string) => void;
  onClearConversation: () => void;
  onUnselectConversation: () => void;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
  onChangeAddon: (addonId: string) => void;
  setShowSettings: (isShow: boolean) => void;
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
  prompts,
  isShowSettings,
  modelIconMapping,
  onSelectModel,
  onClearConversation,
  onUnselectConversation,
  onChangePrompt,
  onChangeTemperature,
  onSelectAssistantSubModel,
  onChangeAddon,
  setShowSettings,
}: Props) => {
  const { t } = useTranslation('chat');
  const {
    state: { lightMode },
  } = useContext(HomeContext);
  const errorSwitchingMessage = t(
    'Switching is not allowed. You are currently talk to {{model}} which maintains internal state, which might be corrupted by a different system.',
    { model: conversation.model.name },
  );
  const [isModelSelectDisabled, setIsModelSelectDisabled] = useState(() =>
    conversation.messages.some((message) => !!message.custom_content?.state),
  );

  useEffect(() => {
    setIsModelSelectDisabled(
      conversation.messages.some((message) => !!message.custom_content?.state),
    );
  }, [conversation.messages]);

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-center bg-gray-200 py-2 text-sm dark:bg-gray-800 [&>*:not(:first-child)]:pl-2 [&>*:not(:last-child)]:border-r-[1px] [&>*:not(:last-child)]:pr-2 [&>*]:border-x-gray-500">
        {/* TODO: recheck env flags */}
        {isShowChatInfo && (
          <>
            <span
              className="max-w-[50px] truncate lg:max-w-[425px]"
              title={conversation.name}
            >
              {conversation.name}
            </span>

            <span>
              <ModelIcon
                modelId={conversation.model.id}
                modelIconMapping={modelIconMapping}
                size={18}
                inverted={lightMode === 'dark'}
              />
            </span>
          </>
        )}
        <div className="flex items-center gap-2">
          {isShowModelSelect && (
            <button
              className="cursor-pointer hover:opacity-50"
              onClick={() => {
                if (isModelSelectDisabled) {
                  toast.error(errorSwitchingMessage);
                  return;
                }
                setShowSettings(!isShowSettings);
              }}
            >
              <IconSettings size={18} />
            </button>
          )}
          {isShowClearConversation && !isCompareMode && (
            <button
              className="cursor-pointer hover:opacity-50"
              onClick={onClearConversation}
            >
              <IconClearAll size={18} />
            </button>
          )}
          {isCompareMode && selectedConversationIds.length > 1 && (
            <button
              className="cursor-pointer hover:opacity-50 disabled:cursor-not-allowed"
              onClick={onUnselectConversation}
              disabled={messageIsStreaming}
            >
              <IconX size={18} />
            </button>
          )}
        </div>
      </div>
      {isShowSettings && (
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

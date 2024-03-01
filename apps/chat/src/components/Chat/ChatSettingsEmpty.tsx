import { useCallback } from 'react';

import { Conversation } from '@/src/types/chat';
import { Prompt } from '@/src/types/prompt';

import { Spinner } from '../Common/Spinner';
import { ConversationSettings } from './ConversationSettings';

interface Props {
  isModels: boolean;
  conversation: Conversation;
  prompts: Prompt[];
  defaultModelId: string;
  isShowSettings: boolean;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
  onChangeAddon: (addonId: string) => void;
  appName: string;
  onApplyAddons: (conversation: Conversation, addonIds: string[]) => void;
}

export const ChatSettingsEmpty = ({
  isModels,
  conversation,
  prompts,
  defaultModelId,
  isShowSettings,
  appName,
  onChangePrompt,
  onChangeTemperature,
  onSelectModel,
  onSelectAssistantSubModel,
  onChangeAddon,
  onApplyAddons,
}: Props) => {
  const handleOnApplyAddons = useCallback(
    (addons: string[]) => {
      onApplyAddons(conversation, addons);
    },
    [conversation, onApplyAddons],
  );

  return (
    <>
      <div className="flex size-full flex-col items-center p-0 md:px-5 md:pt-5">
        <div className="flex size-full flex-col items-center gap-[1px] rounded 2xl:max-w-[1000px]">
          <div className="flex w-full items-center justify-center rounded-t bg-layer-2 p-4">
            {!isModels ? (
              <div>
                <Spinner size={16} className="mx-auto" />
              </div>
            ) : (
              <h4
                data-qa="app-name"
                className="w-full text-center text-xl font-semibold"
              >
                {appName}
              </h4>
            )}
          </div>

          {isShowSettings && isModels && (
            <>
              <ConversationSettings
                conversation={conversation}
                modelId={conversation.model.id || defaultModelId}
                assistantModelId={conversation.assistantModelId}
                prompt={conversation.prompt}
                selectedAddons={conversation.selectedAddons}
                temperature={conversation.temperature}
                prompts={prompts}
                onChangePrompt={onChangePrompt}
                onChangeTemperature={onChangeTemperature}
                onSelectAssistantSubModel={onSelectAssistantSubModel}
                onSelectModel={onSelectModel}
                onChangeAddon={onChangeAddon}
                onApplyAddons={handleOnApplyAddons}
                debounceSystemPromptChanges
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};

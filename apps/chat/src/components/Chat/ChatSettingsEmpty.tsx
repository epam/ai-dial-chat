import { useCallback } from 'react';

import { Conversation } from '@/src/types/chat';
import { Prompt } from '@/src/types/prompt';

import { HEADER_TITLE_TEXT } from '@/src/constants/chat';

import { Spinner } from '../Common/Spinner';
import { ConversationSettings } from './ConversationSettings';

import SecondaryLogo from '@/public/images/icons/secondary-logo.svg';

interface Props {
  isModels: boolean;
  conversation: Conversation;
  prompts: Prompt[];
  isShowSettings: boolean;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
  onChangeAddon: (addonId: string) => void;
  onApplyAddons: (conversation: Conversation, addonIds: string[]) => void;
}

export const ChatSettingsEmpty = ({
  isModels,
  conversation,
  prompts,
  isShowSettings,
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
          {!isModels ? (
            <div className="flex w-full items-center justify-center rounded-t-primary bg-layer-2 p-4">
              <Spinner size={16} className="mx-auto" />
            </div>
          ) : (
            <div className="flex w-full items-center justify-start rounded-t bg-layer-2 px-3 py-2 md:px-5 md:py-4">
              <div className="flex items-center">
                <SecondaryLogo className="" width={27} height={30} />
                <span className="ml-3 font-weave text-[22px] font-bold">
                  {HEADER_TITLE_TEXT}
                </span>
              </div>
            </div>
          )}

          {isShowSettings && isModels && (
            <>
              <ConversationSettings
                conversation={conversation}
                modelId={conversation.model.id}
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

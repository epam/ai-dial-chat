import { useCallback } from 'react';

import { Conversation } from '@/src/types/chat';
import { DialAIEntityModel, ModelsMap } from '@/src/types/models';
import { Prompt } from '@/src/types/prompt';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';

import { Spinner } from '../../Common/Spinner';
import { ModelDescription } from '../ModelDescription';
import { ConversationSettings } from './ConversationSettings';

interface Props {
  appName: string;
  conversation: Conversation;
  modelsMap: ModelsMap;
  prompts: Prompt[];
  showSettings: boolean;
  isModels: boolean;
  onApplyAddons: (conversation: Conversation, addonIds: string[]) => void;
  onChangeAddon: (addonId: string) => void;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
  onSelectModel: (modelId: string) => void;
}

export const ChatSettingsEmpty = ({
  appName,
  conversation,
  modelsMap,
  prompts,
  showSettings,
  isModels,
  onApplyAddons,
  onChangeAddon,
  onChangePrompt,
  onChangeTemperature,
  onSelectAssistantSubModel,
  onSelectModel,
}: Props) => {
  const handleOnApplyAddons = useCallback(
    (addons: string[]) => {
      onApplyAddons(conversation, addons);
    },
    [conversation, onApplyAddons],
  );
  const isolatedModelId = useAppSelector(
    SettingsSelectors.selectIsolatedModelId,
  );

  return (
    <div className="flex size-full flex-col items-center p-0 md:px-5 md:pt-5">
      <div className="flex size-full flex-col items-center gap-[1px] divide-y divide-tertiary rounded bg-layer-2 2xl:max-w-[1000px]">
        {!isModels ? (
          <div className="flex w-full items-center justify-center rounded-t  p-4">
            <Spinner size={16} className="mx-auto" />
          </div>
        ) : (
          <>
            {appName && (
              <div className="flex w-full items-center justify-center rounded-t p-4">
                <h4
                  data-qa="app-name"
                  className="w-full whitespace-pre text-center text-xl font-semibold"
                >
                  {isolatedModelId && modelsMap[isolatedModelId] ? (
                    <ModelDescription
                      model={modelsMap[isolatedModelId] as DialAIEntityModel}
                      className="justify-center"
                      hideMoreInfo
                      isShortDescription
                    />
                  ) : (
                    appName
                  )}
                </h4>
              </div>
            )}
          </>
        )}

        {showSettings && isModels && (
          <ConversationSettings
            conversation={conversation}
            modelId={
              conversation.replay?.replayAsIs
                ? REPLAY_AS_IS_MODEL
                : conversation.model.id
            }
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
        )}
      </div>
    </div>
  );
};

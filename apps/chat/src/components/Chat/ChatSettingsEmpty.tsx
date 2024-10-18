import { useCallback } from 'react';

import { Conversation } from '@/src/types/chat';
import { DialAIEntityModel } from '@/src/types/models';
import { Prompt } from '@/src/types/prompt';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';

import { Spinner } from '../Common/Spinner';
import { ConversationSettings } from './ConversationSettings';
import { ModelDescription } from './ModelDescription';

import { Inversify } from '@epam/ai-dial-modulify-ui';

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
  appName: string;
  onApplyAddons: (conversation: Conversation, addonIds: string[]) => void;
}

export const ChatSettingsEmpty = Inversify.register(
  'ChatSettingsEmpty',
  ({
    isModels,
    conversation,
    prompts,
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
    const isolatedModelId = useAppSelector(
      SettingsSelectors.selectIsolatedModelId,
    );
    const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

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
                    data-qa="entity-name"
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

          {isShowSettings && isModels && (
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
  },
);

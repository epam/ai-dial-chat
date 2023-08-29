import { useContext } from 'react';

import { Conversation } from '@/types/chat';
import { OpenAIEntityAddon, OpenAIEntityModel } from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { useAppSelector } from '@/store/hooks';
import { ModelsSelectors } from '@/store/models/models.reducers';

import HomeContext from '@/pages/api/home/home.context';

import Spinner from '../Spinner';
import { ConversationSettings } from './ConversationSettings';

interface Props {
  models: OpenAIEntityModel[];
  addons: OpenAIEntityAddon[];
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
}

export const ChatSettingsEmpty = ({
  models,
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
}: Props) => {
  const { handleUpdateConversation } = useContext(HomeContext);

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  return (
    <>
      <div className="flex h-full w-full flex-col items-center px-3 pt-5">
        <div className="flex h-full w-[80%] flex-col items-center gap-[1px] rounded">
          <div className="flex w-full items-center justify-center rounded-t bg-gray-200 p-4 dark:bg-gray-800">
            {models.length === 0 ? (
              <div>
                <Spinner size="16px" className="mx-auto" />
              </div>
            ) : (
              <h4 className="w-full text-center text-xl font-semibold">
                {appName}
              </h4>
            )}
          </div>

          {isShowSettings && models.length !== 0 && (
            <>
              <ConversationSettings
                model={
                  modelsMap[conversation.model.id] || modelsMap[defaultModelId]
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
                onApplyAddons={(addons) => {
                  handleUpdateConversation(conversation, {
                    key: 'selectedAddons',
                    value: addons,
                  });
                }}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};

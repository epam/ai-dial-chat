import { Conversation } from '@/src/types/chat';
import { OpenAIEntityAddon, OpenAIEntityModel } from '@/src/types/openai';
import { Prompt } from '@/src/types/prompt';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

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
  const dispatch = useAppDispatch();
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  return (
    <>
      <div className="flex h-full w-full flex-col items-center p-0 md:px-5 md:pt-5">
        <div className="flex h-full w-full flex-col items-center gap-[1px] rounded 2xl:max-w-[1000px]">
          <div className="flex w-full items-center justify-center rounded-t bg-gray-200 p-4 dark:bg-gray-800">
            {models.length === 0 ? (
              <div>
                <Spinner size={16} className="mx-auto" />
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
                conversationId={conversation.id}
                replay={conversation.replay}
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
                  dispatch(
                    ConversationsActions.updateConversation({
                      id: conversation.id,
                      values: { selectedAddons: addons },
                    }),
                  );
                }}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};

import { Conversation } from '@/types/chat';
import {
  OpenAIEntityAddon,
  OpenAIEntityAddonID,
  OpenAIEntityModel,
  OpenAIEntityModelID,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';

import Spinner from '../Spinner';
import { Addons } from './Addons';
import { ChatEmptySettings } from './ChatEmptySettings';

interface Props {
  models: OpenAIEntityModel[];
  addons: OpenAIEntityAddon[];
  conversation: Conversation;
  prompts: Prompt[];
  defaultModelId: OpenAIEntityModelID;
  isShowSettings: boolean;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
  onChangeAddon: (addonId: string) => void;
  appName: string;
}

export const ChatEmpty = ({
  models,
  addons,
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
  const aiEntityType = conversation.model.type;
  const model = models.find(({ id }) => id === conversation.model.id);
  const preselectedAddons =
    (model?.selectedAddons as OpenAIEntityAddonID[]) ?? [];

  return (
    <>
      <div className="mx-auto flex flex-col space-y-2 md:space-y-5 px-3 pt-5 md:pt-12 sm:max-w-[600px]">
        <div className="text-center text-3xl font-semibold text-gray-800 dark:text-gray-100">
          {models.length === 0 ? (
            <div>
              <Spinner size="16px" className="mx-auto" />
            </div>
          ) : (
            appName
          )}
        </div>

        {isShowSettings && models.length > 0 && (
          <>
            <ChatEmptySettings
              defaultModelId={defaultModelId}
              models={models}
              conversation={conversation}
              prompts={prompts}
              onChangePrompt={onChangePrompt}
              onChangeTemperature={onChangeTemperature}
              onSelectAssistantSubModel={onSelectAssistantSubModel}
              onSelectModel={onSelectModel}
            />

            {aiEntityType !== 'application' && (
              <Addons
                addons={addons}
                selectedAddons={conversation.selectedAddons}
                preselectedAddons={preselectedAddons ?? []}
                onChangeAddon={onChangeAddon}
              />
            )}
          </>
        )}
      </div>
    </>
  );
};

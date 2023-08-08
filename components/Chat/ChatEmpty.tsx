import { useContext } from 'react';

import { Conversation } from '@/types/chat';
import {
  OpenAIEntityAddon,
  OpenAIEntityModel,
  OpenAIEntityModelID,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import Spinner from '../Spinner';
import { ConversationSettings } from './ConversationSettings';

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
  const {
    state: { modelsMap },
  } = useContext(HomeContext);

  return (
    <>
      <div className="flex max-h-[560px] w-full flex-col items-center px-3 pt-5">
        <div className="flex flex-col items-center gap-[1px] overflow-hidden rounded sm:max-w-[1000px]">
          <div className="flex w-full items-center justify-center bg-gray-200 p-4 dark:bg-gray-800">
            {models.length === 0 ? (
              <div>
                <Spinner size="16px" className="mx-auto" />
              </div>
            ) : (
              <h4 className="max-w-[80%] text-center text-xl font-semibold">
                {appName}
              </h4>
            )}
          </div>

          {isShowSettings && models.length !== 0 && (
            <>
              <ConversationSettings
                defaultModelId={defaultModelId}
                model={modelsMap[conversation.model.id]}
                conversation={conversation}
                prompts={prompts}
                addons={addons}
                onChangePrompt={onChangePrompt}
                onChangeTemperature={onChangeTemperature}
                onSelectAssistantSubModel={onSelectAssistantSubModel}
                onSelectModel={onSelectModel}
                onChangeAddon={onChangeAddon}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};

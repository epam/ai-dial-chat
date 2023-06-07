import { Conversation } from '@/types/chat';
import { OpenAIModel, OpenAIModelID } from '@/types/openai';
import { Prompt } from '@/types/prompt';

import Spinner from '../Spinner';
import { ChatEmptySettings } from './ChatEmptySettings';

interface Props {
  models: OpenAIModel[];
  conversation: Conversation;
  prompts: Prompt[];
  defaultModelId: OpenAIModelID;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
}

export const ChatEmpty = ({
  models,
  conversation,
  prompts,
  defaultModelId,
  onChangePrompt,
  onChangeTemperature,
  onSelectModel,
}: Props) => {
  return (
    <>
      <div className="mx-auto flex flex-col space-y-5 md:space-y-10 px-3 pt-5 md:pt-12 sm:max-w-[600px]">
        <div className="text-center text-3xl font-semibold text-gray-800 dark:text-gray-100">
          {models.length === 0 ? (
            <div>
              <Spinner size="16px" className="mx-auto" />
            </div>
          ) : (
            'Chatbot UI'
          )}
        </div>

        {models.length > 0 && (
          <ChatEmptySettings
            defaultModelId={defaultModelId}
            models={models}
            conversation={conversation}
            prompts={prompts}
            onChangePrompt={onChangePrompt}
            onChangeTemperature={onChangeTemperature}
            onSelectModel={onSelectModel}
          />
        )}
      </div>
    </>
  );
};

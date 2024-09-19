import { FC } from 'react';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';

import { StoreSelectorsHook } from '@/src/store/useStoreSelectors';

import { ChatSettingsEmpty } from './ChatSettingsEmpty';

interface ChatSettingsEmptySectionProps {
  useStoreSelectors: StoreSelectorsHook;
  // appName: string;
  // selectedConversations: Conversation[];
  // models: DialAIEntityModel[];
  // modelsMap: ModelsMap;
  // prompts: Prompt[];
  inputHeight: number;
  showSettings: boolean;
  onApplyAddons: (conversation: Conversation, addonIds: string[]) => void;
  onChangeAddon: (conv: Conversation, addonId: string) => void;
  onChangePrompt: (conv: Conversation, prompt: string) => void;
  onChangeTemperature: (conv: Conversation, temperature: number) => void;
  onSelectAssistantSubModel: (conv: Conversation, modelId: string) => void;
  onSelectModel: (conv: Conversation, modelId: string) => void;
}

export const ChatSettingsEmptySection: FC<ChatSettingsEmptySectionProps> = ({
  useStoreSelectors,
  inputHeight,
  showSettings,
  onApplyAddons,
  onChangeAddon,
  onChangePrompt,
  onChangeTemperature,
  onSelectAssistantSubModel,
  onSelectModel,
}) => {
  const {
    useSettingsSelectors,
    useConversationsSelectors,
    useModelsSelectors,
    usePromptsSelectors,
  } = useStoreSelectors();
  const { selectedConversations } = useConversationsSelectors([
    'selectSelectedConversations',
  ]);
  const { models, modelsMap } = useModelsSelectors();
  const { prompts } = usePromptsSelectors();
  const { appName } = useSettingsSelectors();

  return (
    <div className="flex max-h-full w-full">
      {selectedConversations.map((conv) =>
        conv.messages.length === 0 ? (
          <div
            key={conv.id}
            className={classNames(
              'flex h-full flex-col justify-between',
              selectedConversations.length > 1 ? 'w-[50%]' : 'w-full',
            )}
          >
            <div
              className="shrink-0"
              style={{
                height: `calc(100% - ${inputHeight}px)`,
              }}
            >
              <ChatSettingsEmpty
                conversation={conv}
                isModels={models.length !== 0}
                prompts={prompts}
                modelsMap={modelsMap}
                showSettings={showSettings}
                onSelectModel={(modelId: string) =>
                  onSelectModel(conv, modelId)
                }
                onSelectAssistantSubModel={(modelId: string) =>
                  onSelectAssistantSubModel(conv, modelId)
                }
                onChangeAddon={(addonId: string) =>
                  onChangeAddon(conv, addonId)
                }
                onChangePrompt={(prompt) => onChangePrompt(conv, prompt)}
                onChangeTemperature={(temperature) =>
                  onChangeTemperature(conv, temperature)
                }
                appName={appName}
                onApplyAddons={onApplyAddons}
              />
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
};

import { IconX } from '@tabler/icons-react';
import { ReactNode, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';
import { isPseudoModel } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { OpenAIEntityModel } from '@/src/types/openai';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { DEFAULT_ASSISTANT_SUBMODEL } from '@/src/constants/default-settings';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { Addons } from './Addons';
import { AssistantSubModelSelector } from './AssistantSubModelSelector';
import { ConversationSettingsModel } from './ConversationSettingsModels';
import { ModelDescription } from './ModelDescription';
import { ReplayAsIsDescription } from './ReplayAsIsDescription';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

interface ModelSelectRowProps {
  item: OpenAIEntityModel;
}

interface SettingContainerProps {
  children: ReactNode;
}

interface Props {
  modelId: string | undefined;
  assistantModelId: string | undefined;
  prompt: string | undefined;
  temperature: number | undefined;
  prompts: Prompt[];
  selectedAddons: string[];
  conversation: Conversation;
  isCloseEnabled?: boolean;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
  onApplyAddons: (addonsIds: string[]) => void;
  onChangeAddon: (addonsId: string) => void;
  onClose?: () => void;
  debounceSystemPromptChanges?: boolean;
}

export const ModelSelectRow = ({ item }: ModelSelectRowProps) => {
  return (
    <div className="flex items-center gap-2">
      <ModelIcon entity={item} entityId={item.id} size={18} />
      <span>{getOpenAIEntityFullName(item)}</span>
    </div>
  );
};

export const SettingContainer = ({ children }: SettingContainerProps) => (
  <div className="grow px-3 py-4 md:px-5">{children}</div>
);

export const ConversationSettings = ({
  modelId,
  assistantModelId,
  prompts,
  prompt,
  temperature,
  selectedAddons,
  isCloseEnabled,
  conversation,
  onClose,
  onSelectModel,
  onSelectAssistantSubModel,
  onChangePrompt,
  onChangeTemperature,
  onChangeAddon,
  onApplyAddons,
  debounceSystemPromptChanges = false,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const model = useMemo(
    () => (modelId ? modelsMap[modelId] : undefined),
    [modelId, modelsMap],
  );

  const isNoModelInUserMessages = useMemo(() => {
    return (
      conversation.replay &&
      conversation.replay.isReplay &&
      conversation.replay.replayUserMessagesStack &&
      conversation.replay.replayUserMessagesStack.some(
        (message) => !message.model,
      )
    );
  }, [conversation.replay]);

  const isPlayback = conversation.playback?.isPlayback;

  return (
    <div className="flex w-full flex-col gap-[1px] overflow-hidden rounded-b bg-layer-1 [&:first-child]:rounded-t">
      <div
        className="relative size-full gap-[1px] overflow-auto md:grid md:grid-cols-2 md:grid-rows-1"
        data-qa="conversation-settings"
      >
        <div className="shrink overflow-auto bg-layer-2 px-3 py-4 md:px-5">
          <ConversationSettingsModel
            conversation={conversation}
            modelId={model?.id}
            unavailableModelId={
              !model?.id && !isPseudoModel(modelId) ? modelId : undefined
            }
            onModelSelect={onSelectModel}
          />
        </div>
        <div
          className="flex shrink flex-col divide-y divide-tertiary overflow-auto bg-layer-2"
          data-qa="entity-settings"
        >
          {!conversation.replay?.replayAsIs ? (
            <>
              {model && model.type === EntityType.Application && (
                <SettingContainer>
                  <ModelDescription model={model} />
                </SettingContainer>
              )}
              {model && model.type === EntityType.Assistant && (
                <SettingContainer>
                  <AssistantSubModelSelector
                    assistantModelId={
                      assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id
                    }
                    onSelectAssistantSubModel={onSelectAssistantSubModel}
                    disabled={isPlayback}
                  />
                </SettingContainer>
              )}
              {(!model || model.type === EntityType.Model) && (
                <SettingContainer>
                  <SystemPrompt
                    maxLength={
                      model ? model.maxLength : Number.MAX_SAFE_INTEGER
                    }
                    prompt={prompt}
                    prompts={prompts}
                    onChangePrompt={onChangePrompt}
                    debounceChanges={debounceSystemPromptChanges}
                    disabled={isPlayback}
                  />
                </SettingContainer>
              )}
              {(!model || model.type !== EntityType.Application) && (
                <SettingContainer>
                  <TemperatureSlider
                    label={t('Temperature')}
                    onChangeTemperature={onChangeTemperature}
                    temperature={temperature}
                    disabled={isPlayback}
                  />
                </SettingContainer>
              )}
              {(!model || model.type !== EntityType.Application) && (
                <SettingContainer>
                  <Addons
                    preselectedAddonsIds={model?.selectedAddons || []}
                    selectedAddonsIds={selectedAddons}
                    onChangeAddon={onChangeAddon}
                    onApplyAddons={onApplyAddons}
                    disabled={isPlayback}
                  />
                </SettingContainer>
              )}
            </>
          ) : (
            <ReplayAsIsDescription
              isModelInMessages={isNoModelInUserMessages}
            />
          )}
        </div>
        {isCloseEnabled && (
          <button
            className="absolute right-3 top-3 text-secondary hover:text-accent-primary"
            onClick={onClose}
          >
            <IconX height={24} width={24} />
          </button>
        )}
      </div>
    </div>
  );
};

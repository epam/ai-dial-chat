import { ReactNode } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isPlaybackConversation } from '@/src/utils/app/conversation';
import { DefaultsService } from '@/src/utils/app/data/defaults-service';
import {
  doesModelAllowSystemPrompt,
  doesModelAllowTemperature,
  doesModelHaveSettings,
} from '@/src/utils/app/models';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import { FALLBACK_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

import { AssistantSubModelSelector } from './AssistantSubModelSelector';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

import { Inversify } from '@epam/ai-dial-modulify-ui';

interface SettingContainerProps {
  children: ReactNode;
}

interface Props {
  assistantModelId: string | undefined;
  prompt: string | undefined;
  temperature: number | undefined;
  prompts: Prompt[];
  conversation: Conversation;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
}

export function FieldContainer({ children }: SettingContainerProps) {
  if (!children) {
    return null;
  }

  return <div className="px-3 py-4 md:px-6">{children}</div>;
}

export function SettingContainer({ children }: SettingContainerProps) {
  if (!children) {
    return <EmptySettings />;
  }

  return (
    <div className="flex w-full flex-col bg-layer-2" data-qa="entity-settings">
      {children}
    </div>
  );
}

function EmptySettings() {
  const { t } = useTranslation(Translation.Chat);

  return (
    <SettingContainer>
      <FieldContainer>
        {t('There are no conversation settings for this agent ')}
      </FieldContainer>
    </SettingContainer>
  );
}

export const ConversationSettings = Inversify.register(
  'ConversationSettings',
  ({
    assistantModelId,
    prompts,
    prompt,
    temperature,
    conversation,
    onSelectAssistantSubModel,
    onChangePrompt,
    onChangeTemperature,
  }: Props) => {
    const { t } = useTranslation(Translation.Chat);

    const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

    const model = modelsMap[conversation.model.id];
    const isPlayback = isPlaybackConversation(conversation);

    if (!model) {
      return (
        <SettingContainer>
          <FieldContainer>{t('Agent is not available')}</FieldContainer>
        </SettingContainer>
      );
    }

    if (!doesModelHaveSettings(model)) {
      return <EmptySettings />;
    }

    return (
      <SettingContainer>
        {model.type === EntityType.Assistant && (
          <FieldContainer>
            <AssistantSubModelSelector
              assistantModelReference={
                assistantModelId ??
                DefaultsService.get(
                  'assistantSubmodelId',
                  FALLBACK_ASSISTANT_SUBMODEL_ID,
                )
              }
              onSelectAssistantSubModel={onSelectAssistantSubModel}
              disabled={isPlayback}
            />
          </FieldContainer>
        )}
        {model.type === EntityType.Model &&
          doesModelAllowSystemPrompt(model) && (
            <FieldContainer>
              <SystemPrompt
                maxTokensLength={model?.limits?.maxRequestTokens ?? Infinity}
                tokenizer={model?.tokenizer}
                prompt={prompt}
                prompts={prompts}
                onChangePrompt={onChangePrompt}
                disabled={isPlayback}
              />
            </FieldContainer>
          )}
        {doesModelAllowTemperature(model) && (
          <FieldContainer>
            <TemperatureSlider
              label={t('Temperature')}
              onChangeTemperature={onChangeTemperature}
              temperature={temperature}
              disabled={isPlayback}
            />
          </FieldContainer>
        )}
      </SettingContainer>
    );
  },
);

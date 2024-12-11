import { ReactNode } from 'react';

import { useTranslation } from 'next-i18next';

import { DefaultsService } from '@/src/utils/app/data/defaults-service';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { FALLBACK_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

import { Addons } from './Addons';
import { AssistantSubModelSelector } from './AssistantSubModelSelector';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

interface SettingContainerProps {
  children: ReactNode;
}

interface Props {
  assistantModelId: string | undefined;
  prompt: string | undefined;
  temperature: number | undefined;
  prompts: Prompt[];
  selectedAddons: string[];
  conversation: Conversation;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
  onApplyAddons: (addonsIds: string[]) => void;
  onChangeAddon: (addonsId: string) => void;
}

export const SettingContainer = ({ children }: SettingContainerProps) => {
  if (!children) {
    return null;
  }

  return <div className="px-3 py-4 md:px-6">{children}</div>;
};

export const ConversationSettings = ({
  assistantModelId,
  prompts,
  prompt,
  temperature,
  selectedAddons,
  conversation,
  onSelectAssistantSubModel,
  onChangePrompt,
  onChangeTemperature,
  onChangeAddon,
  onApplyAddons,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const model = modelsMap[conversation.model.id];
  const isPlayback = !!conversation.playback?.isPlayback;

  const isNotAllowedModel = !modelsMap[conversation.model.id];

  return (
    <div className="flex w-full flex-col bg-layer-2" data-qa="entity-settings">
      {!isNotAllowedModel ? (
        <>
          {model && model.type === EntityType.Application && (
            <SettingContainer>
              {t('There are no conversation settings for this agent ')}
            </SettingContainer>
          )}
          {model && model.type === EntityType.Assistant && (
            <SettingContainer>
              <AssistantSubModelSelector
                assistantModelId={
                  assistantModelId ??
                  DefaultsService.get(
                    'assistantSubmodelId',
                    FALLBACK_ASSISTANT_SUBMODEL_ID,
                  )
                }
                onSelectAssistantSubModel={onSelectAssistantSubModel}
                disabled={isPlayback}
              />
            </SettingContainer>
          )}
          {(!model ||
            (model.type === EntityType.Model &&
              model?.features?.systemPrompt)) && (
            <SettingContainer>
              <SystemPrompt
                maxTokensLength={model?.limits?.maxRequestTokens ?? Infinity}
                tokenizer={model?.tokenizer}
                prompt={prompt}
                prompts={prompts}
                onChangePrompt={onChangePrompt}
                disabled={isPlayback}
              />
            </SettingContainer>
          )}
          {(!model || model.type !== EntityType.Application) && (
            <SettingContainer>
              <TemperatureSlider
                label={t('Temperature') ?? ''}
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
        <SettingContainer>{t('Agent is not available')}</SettingContainer>
      )}
    </div>
  );
};

import { ReactNode } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isPlaybackConversation } from '@/src/utils/app/conversation';
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
import { ModelsSelectors, OverlaySelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { CompactMode } from '@/src/components/Chat/ChatSettings/CompactMode';
import { ResponseFormat } from '@/src/components/Chat/ChatSettings/ResponseFormat';

import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

import { Inversify } from '@epam/ai-dial-modulify-ui';
import { ConversationResponseFormat } from '@epam/ai-dial-shared';

interface Props {
  prompt: string | undefined;
  temperature: number | undefined;
  responseFormat: ConversationResponseFormat;
  prompts: Prompt[];
  conversation: Conversation;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onChangeResponseFormat: (responseFormat: ConversationResponseFormat) => void;
  compactMode: boolean;
  onChangeCompactMode: (compactMode: boolean) => void;
}

const renderFieldContainer = (children: ReactNode) => {
  if (!children) {
    return null;
  }

  return <div className="px-3 py-4 md:px-6">{children}</div>;
};

const renderSettingContainer = (children: ReactNode) => {
  if (!children) {
    return null;
  }

  return (
    <div className="flex w-full flex-col bg-layer-2" data-qa="entity-settings">
      {children}
    </div>
  );
};

const renderEmptySettings = (label: string) => {
  return renderSettingContainer(renderFieldContainer(label));
};

export const ConversationSettings = Inversify.register(
  'ConversationSettings',
  ({
    prompts,
    prompt,
    responseFormat,
    temperature,
    conversation,
    onChangePrompt,
    onChangeTemperature,
    onChangeResponseFormat,
    compactMode,
    onChangeCompactMode,
  }: Props) => {
    const { t } = useTranslation(Translation.Chat);

    const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
    const overlaySystemPrompt = useAppSelector(
      OverlaySelectors.selectOverlaySystemPrompt,
    );

    const model = modelsMap[conversation.model.id];
    const isPlayback = isPlaybackConversation(conversation);

    if (!model) {
      return renderSettingContainer(
        renderFieldContainer(t(ChatI18nKeys.AgentIsNotAvailable)),
      );
    }

    if (!doesModelHaveSettings(model)) {
      return renderSettingContainer(
        <>
          {renderFieldContainer(
            <ResponseFormat
              value={responseFormat}
              onChange={onChangeResponseFormat}
              disabled={isPlayback}
            />,
          )}
          {renderFieldContainer(
            <CompactMode
              value={compactMode}
              onChange={onChangeCompactMode}
              disabled={isPlayback}
            />,
          )}
        </>,
      );
    }

    const settingsContent = (
      <>
        {renderFieldContainer(
          <ResponseFormat
            value={responseFormat}
            onChange={onChangeResponseFormat}
            disabled={isPlayback}
          />,
        )}
        {renderFieldContainer(
          <CompactMode
            value={compactMode}
            onChange={onChangeCompactMode}
            disabled={isPlayback}
          />,
        )}
        {model.type === EntityType.Model &&
          doesModelAllowSystemPrompt(model) &&
          !overlaySystemPrompt &&
          renderFieldContainer(
            <SystemPrompt
              maxTokensLength={model?.limits?.maxRequestTokens ?? Infinity}
              tokenizer={model?.tokenizer}
              prompt={prompt}
              prompts={prompts}
              onChangePrompt={onChangePrompt}
              disabled={isPlayback}
            />,
          )}
        {doesModelAllowTemperature(model) &&
          renderFieldContainer(
            <TemperatureSlider
              label={t(ChatI18nKeys.Temperature)}
              onChangeTemperature={onChangeTemperature}
              temperature={temperature}
              disabled={isPlayback}
            />,
          )}
      </>
    );

    return renderSettingContainer(
      settingsContent ||
        renderEmptySettings(t(ChatI18nKeys.NoConversationSettings)),
    );
  },
);

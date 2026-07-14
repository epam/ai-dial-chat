import type {
  Conversation,
  DeploymentFeatures,
  ResponseFormat,
} from '@epam/ai-dial-chat-shared';
import type { ChatSettingsValues } from '@epam/ai-dial-conversation-input';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ChatSettingsI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { normalizeResponseFormat } from '../../utils/message-utils';

interface LocalModeValues {
  responseFormat: ResponseFormat;
  systemPrompt: string;
  temperature: number;
}

interface LocalModeParams {
  mode: 'local';
  values: LocalModeValues;
  onValuesChange: (values: LocalModeValues) => void;
  deploymentFeatures?: DeploymentFeatures;
}

interface ConversationModeParams {
  mode: 'conversation';
  conversation: Conversation;
  onConversationChange: (conversation: Conversation) => void;
  deploymentFeatures?: DeploymentFeatures;
}

type Params = LocalModeParams | ConversationModeParams;

export const useChatSettingsFormConfig = (params: Params) => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();

  const responseFormat =
    params.mode === 'local'
      ? params.values.responseFormat
      : normalizeResponseFormat(
          params.conversation.responseFormat as string | undefined,
        );
  const systemPrompt =
    params.mode === 'local'
      ? params.values.systemPrompt
      : (params.conversation.prompt ?? '');
  const temperature =
    params.mode === 'local'
      ? params.values.temperature
      : (params.conversation.temperature ?? 0.5);

  const handleSave = useCallback(
    (values: ChatSettingsValues) => {
      if (params.mode === 'local') {
        params.onValuesChange({
          responseFormat: values.responseFormat ?? params.values.responseFormat,
          systemPrompt: values.systemPrompt ?? params.values.systemPrompt,
          temperature: values.temperature ?? params.values.temperature,
        });
      } else {
        params.onConversationChange({
          ...params.conversation,
          ...(values.responseFormat != null && {
            responseFormat: values.responseFormat,
          }),
          ...(values.systemPrompt != null && {
            prompt: values.systemPrompt,
          }),
          ...(values.temperature != null && {
            temperature: values.temperature,
          }),
        });
      }
      showNotification({
        variant: NotificationVariant.Success,
        message: t(ChatSettingsI18nKeys.SavedNotification),
      });
    },
    [params, showNotification, t],
  );

  return useMemo(
    () => ({
      features: {
        ...(params.deploymentFeatures ?? {
          systemPrompt: false,
          temperature: false,
        }),
        responseFormat: true,
      },
      responseFormat,
      systemPrompt,
      temperature,
      onSave: handleSave,
      menuItemLabel: t(BasicI18nKeys.Settings),
      title: t(BasicI18nKeys.Settings),
      responseFormatLabel: t(ChatSettingsI18nKeys.ResponseFormatLabel),
      responseFormatHint: t(ChatSettingsI18nKeys.ResponseFormatHint),
      responseFormatMarkdownLabel: t(
        ChatSettingsI18nKeys.ResponseFormatMarkdown,
      ),
      responseFormatPlainTextLabel: t(
        ChatSettingsI18nKeys.ResponseFormatPlainText,
      ),
      systemPromptLabel: t(ChatSettingsI18nKeys.SystemPromptLabel),
      systemPromptTooltip: t(ChatSettingsI18nKeys.SystemPromptTooltip),
      temperatureLabel: t(ChatSettingsI18nKeys.TemperatureLabel),
      temperatureLabels: [
        t(ChatSettingsI18nKeys.TemperaturePrecise),
        t(ChatSettingsI18nKeys.TemperatureNeutral),
        t(ChatSettingsI18nKeys.TemperatureCreative),
      ] as [string, string, string],
      temperatureHint: t(ChatSettingsI18nKeys.TemperatureHint),
      saveLabel: t(ChatSettingsI18nKeys.SaveLabel),
      saveDisabledTooltip: t(ChatSettingsI18nKeys.SaveDisabledTooltip),
    }),
    [
      params.deploymentFeatures,
      responseFormat,
      systemPrompt,
      temperature,
      handleSave,
      t,
    ],
  );
};

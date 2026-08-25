import type { ChatSettingsFormLabels } from '@epam/ai-dial-chat-hooks';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ChatSettingsI18nKeys,
} from '../../constants/translation-keys';

/**
 * Builds the `ChatSettingsFormLabels` for {@link useChatSettingsFormConfig}
 * from the app's i18n catalog. Keeps translation out of the headless lib.
 */
export const useChatSettingsFormLabels = (): ChatSettingsFormLabels => {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      settings: t(BasicI18nKeys.Settings),
      savedNotification: t(ChatSettingsI18nKeys.SavedNotification),
      responseFormatLabel: t(ChatSettingsI18nKeys.ResponseFormatLabel),
      responseFormatHint: t(ChatSettingsI18nKeys.ResponseFormatHint),
      responseFormatMarkdown: t(ChatSettingsI18nKeys.ResponseFormatMarkdown),
      responseFormatPlainText: t(ChatSettingsI18nKeys.ResponseFormatPlainText),
      systemPromptLabel: t(ChatSettingsI18nKeys.SystemPromptLabel),
      systemPromptTooltip: t(ChatSettingsI18nKeys.SystemPromptTooltip),
      temperatureLabel: t(ChatSettingsI18nKeys.TemperatureLabel),
      temperaturePrecise: t(ChatSettingsI18nKeys.TemperaturePrecise),
      temperatureNeutral: t(ChatSettingsI18nKeys.TemperatureNeutral),
      temperatureCreative: t(ChatSettingsI18nKeys.TemperatureCreative),
      temperatureHint: t(ChatSettingsI18nKeys.TemperatureHint),
      saveLabel: t(ChatSettingsI18nKeys.SaveLabel),
      saveDisabledTooltip: t(ChatSettingsI18nKeys.SaveDisabledTooltip),
    }),
    [t],
  );
};

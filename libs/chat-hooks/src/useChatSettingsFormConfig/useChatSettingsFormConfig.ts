import {
  ResponseFormat,
  type Conversation,
  type DeploymentFeatures,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useMemo } from 'react';

/** Values emitted by the chat-settings modal when the user clicks Save. */
export interface ChatSettingsValues {
  /** Updated response format, present when the response-format field was shown. */
  responseFormat?: ResponseFormat;
  /** Updated system prompt, present when the system-prompt field was shown. */
  systemPrompt?: string;
  /** Updated temperature, present when the temperature field was shown. */
  temperature?: number;
}

/**
 * Translatable strings the chat-settings form surfaces. Every field defaults
 * to an English fallback inside the hook; pass translated values from the
 * consuming app (e.g. via a `useTranslation`-backed labels hook).
 */
export interface ChatSettingsFormLabels {
  /** Dropdown item label and modal title. */
  settings: string;
  /** Toast/message text announced after a successful save. */
  savedNotification: string;
  /** Label for the response-format field. */
  responseFormatLabel: string;
  /** Helper text shown below the response-format field. */
  responseFormatHint: string;
  /** Label for the Markdown radio option. */
  responseFormatMarkdown: string;
  /** Label for the plain-text radio option. */
  responseFormatPlainText: string;
  /** Label for the system-prompt field. */
  systemPromptLabel: string;
  /** Tooltip for the system-prompt field. */
  systemPromptTooltip: string;
  /** Label for the temperature field. */
  temperatureLabel: string;
  /** Label for the precise end of the temperature slider. */
  temperaturePrecise: string;
  /** Label for the neutral midpoint of the temperature slider. */
  temperatureNeutral: string;
  /** Label for the creative end of the temperature slider. */
  temperatureCreative: string;
  /** Hint text shown below the temperature field. */
  temperatureHint: string;
  /** Save button label. */
  saveLabel: string;
  /** Tooltip shown on the disabled Save button. */
  saveDisabledTooltip: string;
}

/** Configuration the chat-settings popover/modal consumes. */
export type UseChatSettingsFormConfigResult = {
  /** Feature flags controlling which fields appear. */
  features: {
    systemPrompt: boolean;
    temperature: boolean;
    responseFormat: boolean;
  };
  /** Current response format pre-selected in the modal. */
  responseFormat: ResponseFormat;
  /** Current system prompt pre-populated in the modal. */
  systemPrompt: string;
  /** Current temperature pre-populated in the modal. */
  temperature: number;
  /** Called with updated values when the user clicks Save. */
  onSave: (values: ChatSettingsValues) => void;
  /** Label for the dropdown menu item. */
  menuItemLabel: string;
  /** Modal title. */
  title: string;
  /** Label for the response-format field. */
  responseFormatLabel: string;
  /** Helper text shown below the response-format field. */
  responseFormatHint: string;
  /** Label for the Markdown radio option. */
  responseFormatMarkdownLabel: string;
  /** Label for the plain-text radio option. */
  responseFormatPlainTextLabel: string;
  /** Label for the system-prompt field. */
  systemPromptLabel: string;
  /** Tooltip for the system-prompt field. */
  systemPromptTooltip: string;
  /** Label for the temperature field. */
  temperatureLabel: string;
  /** Slider endpoint labels, in `[precise, neutral, creative]` order. */
  temperatureLabels: [string, string, string];
  /** Hint text shown below the temperature field. */
  temperatureHint: string;
  /** Save button label. */
  saveLabel: string;
  /** Tooltip shown on the disabled Save button. */
  saveDisabledTooltip: string;
};

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
  /** True when the selected deployment is a Quick App. Its orchestrator sets its own fixed temperature, so the temperature field is forced off regardless of `deploymentFeatures`. */
  isQuickApp?: boolean;
}

interface ConversationModeParams {
  mode: 'conversation';
  conversation: Conversation;
  onConversationChange: (conversation: Conversation) => void;
  deploymentFeatures?: DeploymentFeatures;
  /** True when the conversation's deployment is a Quick App. Its orchestrator sets its own fixed temperature, so the temperature field is forced off regardless of `deploymentFeatures`. */
  isQuickApp?: boolean;
}

type Params = LocalModeParams | ConversationModeParams;

/** Common, host-injected options shared by both modes. */
interface Options {
  /** Translatable labels. Fields not provided fall back to English defaults. */
  labels?: Partial<ChatSettingsFormLabels>;
  /** Called after a successful save so the host can surface its own toast/notification. */
  onSaved?: () => void;
}

const DEFAULT_LABELS: ChatSettingsFormLabels = {
  settings: 'Settings',
  savedNotification: 'Chat settings have been saved',
  responseFormatLabel: 'Response format',
  responseFormatHint: 'Applies to new and existing messages',
  responseFormatMarkdown: 'Markdown',
  responseFormatPlainText: 'Plain text',
  systemPromptLabel: 'System prompt',
  systemPromptTooltip: 'Enter a prompt',
  temperatureLabel: 'Temperature',
  temperaturePrecise: 'Precise',
  temperatureNeutral: 'Neutral',
  temperatureCreative: 'Creative',
  temperatureHint:
    'Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.',
  saveLabel: 'Apply changes',
  saveDisabledTooltip: 'Please select a response format',
};

/** Normalizes a raw response-format string into the `ResponseFormat` enum. */
const normalizeResponseFormat = (value: string | undefined): ResponseFormat => {
  const lower = (value ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (lower === 'plaintext') return ResponseFormat.PlainText;
  return ResponseFormat.Markdown;
};

/**
 * Assembles the chat-settings form config (feature flags, current values, save
 * handler, labels) for either an in-flight local composer or a persisted
 * conversation. Headless: translation and notifications are the host's
 * responsibility, supplied via `labels` and `onSaved`.
 */
export const useChatSettingsFormConfig = (
  params: Params & Options,
): UseChatSettingsFormConfigResult => {
  const labels = useMemo(
    () => ({ ...DEFAULT_LABELS, ...params.labels }),
    [params.labels],
  );
  const { onSaved } = params;

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
      onSaved?.();
    },
    // `params` is a union; re-evaluate whenever the caller passes a new object.
    // `onSaved` is captured separately so a stable callback identity keeps this memo stable.
    [onSaved, params],
  );

  const isSystemPromptEnabled =
    params.deploymentFeatures?.systemPrompt ?? false;
  const isTemperatureEnabled =
    !params.isQuickApp && (params.deploymentFeatures?.temperature ?? false);

  return useMemo(
    () => ({
      features: {
        systemPrompt: isSystemPromptEnabled,
        temperature: isTemperatureEnabled,
        responseFormat: true,
      },
      responseFormat,
      systemPrompt,
      temperature,
      onSave: handleSave,
      menuItemLabel: labels.settings,
      title: labels.settings,
      responseFormatLabel: labels.responseFormatLabel,
      responseFormatHint: labels.responseFormatHint,
      responseFormatMarkdownLabel: labels.responseFormatMarkdown,
      responseFormatPlainTextLabel: labels.responseFormatPlainText,
      systemPromptLabel: labels.systemPromptLabel,
      systemPromptTooltip: labels.systemPromptTooltip,
      temperatureLabel: labels.temperatureLabel,
      temperatureLabels: [
        labels.temperaturePrecise,
        labels.temperatureNeutral,
        labels.temperatureCreative,
      ],
      temperatureHint: labels.temperatureHint,
      saveLabel: labels.saveLabel,
      saveDisabledTooltip: labels.saveDisabledTooltip,
    }),
    [
      handleSave,
      isSystemPromptEnabled,
      isTemperatureEnabled,
      labels,
      responseFormat,
      systemPrompt,
      temperature,
    ],
  );
};

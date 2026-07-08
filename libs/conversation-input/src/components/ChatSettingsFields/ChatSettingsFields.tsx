import type { DeploymentFeatures } from '@epam/ai-dial-chat-shared';
import { ResponseFormat } from '@epam/ai-dial-chat-shared';
import {
  DialInput,
  DialRadioGroup,
  DialSlider,
  RadioGroupOrientation,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';

const LABEL_CLASS_NAME =
  '!text-[14px] !leading-[20px] font-semibold !text-primary gap-1';

/** Props for the shared chat-settings form fields. */
export interface ChatSettingsFieldsProps {
  /** Feature flags controlling which fields are rendered. */
  features: DeploymentFeatures;
  /** Current response format value. `undefined` when no option is selected. */
  responseFormat: ResponseFormat | undefined;
  /** Current system prompt value. */
  systemPrompt: string;
  /** Current temperature value. */
  temperature: number;
  /** Called when the response format radio selection changes. */
  onResponseFormatChange: (v: ResponseFormat) => void;
  /** Called when the system prompt textarea value changes. */
  onSystemPromptChange: (v: string) => void;
  /** Called when the temperature slider value changes. */
  onTemperatureChange: (v: number) => void;
  /** Label for the response format field. Defaults to `'Response format'`. */
  responseFormatLabel?: string;
  /** Helper text shown below the response format field. Defaults to `'Applies to new and existing messages'`. */
  responseFormatHint?: string;
  /** Label for the Markdown radio option. Defaults to `'Markdown'`. */
  responseFormatMarkdownLabel?: string;
  /** Label for the Plain text radio option. Defaults to `'Plain text'`. */
  responseFormatPlainTextLabel?: string;
  /** Label for the system prompt field. Defaults to `'System prompt'`. */
  systemPromptLabel?: string;
  /** Placeholder shown in the system prompt textarea. Defaults to `'Enter a prompt'`. */
  systemPromptTooltip?: string;
  /** Label for the temperature field. Defaults to `'Temperature'`. */
  temperatureLabel?: string;
  /** Labels rendered below the temperature slider track: [start, middle, end]. Defaults to `['Precise', 'Neutral', 'Creative']`. */
  temperatureLabels?: [string, string, string];
  /** Helper text shown below the temperature field. */
  temperatureHint?: string;
}

/** Shared form fields for the chat-settings UI, used by both the desktop modal and mobile bottom sheet. */
export const ChatSettingsFields: FC<ChatSettingsFieldsProps> = ({
  features,
  responseFormat,
  systemPrompt,
  temperature,
  onResponseFormatChange,
  onSystemPromptChange,
  onTemperatureChange,
  responseFormatLabel = 'Response format',
  responseFormatHint = 'Applies to new and existing messages',
  responseFormatMarkdownLabel = 'Markdown',
  responseFormatPlainTextLabel = 'Plain text',
  systemPromptLabel = 'System prompt',
  systemPromptTooltip = 'Enter a prompt',
  temperatureLabel = 'Temperature',
  temperatureLabels = ['Precise', 'Neutral', 'Creative'],
  temperatureHint,
}) => (
  <div className="flex flex-col px-6">
    {features.responseFormat && (
      <DialRadioGroup
        fieldTitle={responseFormatLabel}
        elementId="response-format"
        orientation={RadioGroupOrientation.Column}
        activeRadioButton={responseFormat ?? ResponseFormat.Markdown}
        labelDescription={responseFormatHint}
        labelClassName={LABEL_CLASS_NAME}
        radioButtons={[
          {
            id: ResponseFormat.Markdown,
            name: responseFormatMarkdownLabel,
          },
          {
            id: ResponseFormat.PlainText,
            name: responseFormatPlainTextLabel,
          },
        ]}
        onChange={(v) => onResponseFormatChange(v as ResponseFormat)}
      />
    )}
    {features.systemPrompt && (
      <DialInput
        value={systemPrompt}
        placeholder={systemPromptTooltip}
        labelProps={{
          label: systemPromptLabel,
          className: LABEL_CLASS_NAME,
        }}
        containerClassName="py-4 gap-3"
        onChange={(value) => onSystemPromptChange(value ?? '')}
      />
    )}
    {features.temperature && (
      <DialSlider
        labelProps={{
          label: temperatureLabel,
          className: LABEL_CLASS_NAME,
          caption: temperatureHint,
        }}
        className="gap-3 py-4"
        value={temperature}
        min={0}
        max={1}
        step={0.1}
        labels={temperatureLabels}
        onChange={onTemperatureChange}
      />
    )}
  </div>
);

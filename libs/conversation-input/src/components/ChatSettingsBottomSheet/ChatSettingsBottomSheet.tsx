import type { DeploymentFeatures } from '@epam/ai-dial-chat-shared';
import { mergeClasses, ResponseFormat } from '@epam/ai-dial-chat-shared';
import { DialTooltip, PrimaryButton } from '@epam/ai-dial-ui-kit';
import type { CSSProperties, FC } from 'react';
import { useChatSettingsForm } from '../../hooks/useChatSettingsForm';
import type { ChatSettingsValues } from '../../models/Input';
import { BottomSheetShell } from '../BottomSheetShell/BottomSheetShell';
import { ChatSettingsFields } from '../ChatSettingsFields/ChatSettingsFields';

/** Props for the ChatSettingsBottomSheet component. */
export interface ChatSettingsBottomSheetProps {
  /** Controls sheet visibility. */
  isOpen: boolean;
  /** Called when the back arrow is tapped — returns to the previous sheet. */
  onBack: () => void;
  /** Accessible label for the back arrow button. */
  backLabel: string;
  /** Called when the close (×) button is tapped — dismisses the sheet entirely. */
  onClose: () => void;
  /** Accessible label for the close (×) button. */
  closeLabel: string;
  /** Inline CSS custom properties forwarded to the sheet root for theming. */
  style?: CSSProperties;
  /** Feature flags for the active deployment — controls which fields are shown. */
  features: DeploymentFeatures;
  /** Current response format value pre-selected in the radio group. */
  initialResponseFormat: ResponseFormat;
  /** Current system prompt value pre-populated in the textarea. */
  initialSystemPrompt: string;
  /** Current temperature value pre-populated in the slider. */
  initialTemperature: number;
  /** Called with the updated values when the user saves. */
  onSave: (values: ChatSettingsValues) => void;
  /** Sheet title. Defaults to `'Chat settings'`. */
  title?: string;
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
  /** Label for the save button. Defaults to `'Apply changes'`. */
  saveLabel?: string;
  /** Tooltip shown on the save button when it is disabled (e.g. no response format selected). */
  saveDisabledTooltip?: string;
}

/** Mobile bottom sheet for chat settings with a back button to return to the preceding sheet. */
export const ChatSettingsBottomSheet: FC<ChatSettingsBottomSheetProps> = ({
  isOpen,
  onBack,
  backLabel,
  onClose,
  closeLabel,
  style,
  features,
  initialResponseFormat,
  initialSystemPrompt,
  initialTemperature,
  onSave,
  title = 'Chat settings',
  responseFormatLabel,
  responseFormatHint,
  responseFormatMarkdownLabel,
  responseFormatPlainTextLabel,
  systemPromptLabel,
  systemPromptTooltip,
  temperatureLabel,
  temperatureLabels,
  temperatureHint,
  saveLabel = 'Apply changes',
  saveDisabledTooltip,
}) => {
  const {
    responseFormat,
    systemPrompt,
    temperature,
    canSubmit,
    setResponseFormat,
    setSystemPrompt,
    setTemperature,
    handleSubmit,
  } = useChatSettingsForm({
    isOpen,
    features,
    initialResponseFormat,
    initialSystemPrompt,
    initialTemperature,
    onSave,
    onClose,
  });

  return (
    <BottomSheetShell
      isOpen={isOpen}
      title={title}
      closeLabel={closeLabel}
      onClose={onClose}
      onBack={onBack}
      backLabel={backLabel}
      style={style}
    >
      <ChatSettingsFields
        features={features}
        responseFormat={responseFormat}
        systemPrompt={systemPrompt}
        temperature={temperature}
        onResponseFormatChange={setResponseFormat}
        onSystemPromptChange={setSystemPrompt}
        onTemperatureChange={setTemperature}
        responseFormatLabel={responseFormatLabel}
        responseFormatHint={responseFormatHint}
        responseFormatMarkdownLabel={responseFormatMarkdownLabel}
        responseFormatPlainTextLabel={responseFormatPlainTextLabel}
        systemPromptLabel={systemPromptLabel}
        systemPromptTooltip={systemPromptTooltip}
        temperatureLabel={temperatureLabel}
        temperatureLabels={temperatureLabels}
        temperatureHint={temperatureHint}
      />
      <div className={mergeClasses('px-6 py-4 mobile:pb-8')}>
        <DialTooltip
          tooltip={saveDisabledTooltip}
          hideTooltip={canSubmit || !saveDisabledTooltip}
          triggerClassName="w-full"
        >
          <PrimaryButton
            label={saveLabel}
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
          />
        </DialTooltip>
      </div>
    </BottomSheetShell>
  );
};

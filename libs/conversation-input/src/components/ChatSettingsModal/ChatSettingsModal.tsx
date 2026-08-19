import type { DeploymentFeatures } from '@epam/ai-dial-chat-shared';
import { ResponseFormat } from '@epam/ai-dial-chat-shared';
import {
  Popup,
  DialTooltip,
  PrimaryButton,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { useChatSettingsForm } from '../../hooks/useChatSettingsForm';
import type { ChatSettingsValues } from '../../models/Input';
import { ChatSettingsFields } from '../ChatSettingsFields/ChatSettingsFields';
import styles from './ChatSettingsModal.module.scss';

/** Props for the ChatSettingsModal component. */
export interface ChatSettingsModalProps {
  /** Feature flags for the active deployment — controls which fields are shown. */
  features: DeploymentFeatures;
  /** Current response format value pre-selected in the radio group. */
  initialResponseFormat: ResponseFormat;
  /** Current system prompt value pre-populated in the textarea. */
  initialSystemPrompt: string;
  /** Current temperature value pre-populated in the slider. */
  initialTemperature: number;
  /** Called with the updated values when the modal closes. */
  onSave: (values: ChatSettingsValues) => void;
  /** Called when the modal should close. */
  onClose: () => void;
  /** Modal title. Defaults to `'Chat settings'`. */
  title?: string;
  /** CSS class applied to the modal title. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
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
  /** Tooltip shown on the system prompt input. Defaults to `'Enter a prompt'`. */
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
  /**
   * CSS class applied for the modal background. Defaults to a
   * `--bg-layer-raised` background. `Popup` renders through a portal and
   * accepts no `style`, so this class (or setting `--csm-bg` at theme level) is
   * the only way to override the surface color — there is no `colors` prop.
   */
  backgroundClassName?: string;
}

/** Desktop modal for chat settings (system prompt, temperature, response format). */
export const ChatSettingsModal: FC<ChatSettingsModalProps> = ({
  features,
  initialResponseFormat,
  initialSystemPrompt,
  initialTemperature,
  onSave,
  onClose,
  title = 'Chat settings',
  titleClassName = 'dial-h1-text',
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
  backgroundClassName = styles.modal,
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
    features,
    initialResponseFormat,
    initialSystemPrompt,
    initialTemperature,
    onSave,
    onClose,
  });

  return (
    <Popup
      open
      header={title}
      titleClassName={titleClassName}
      size={PopupSize.Sm}
      onClose={onClose}
      className={backgroundClassName}
      footer={
        <div className="flex justify-end px-6 py-4">
          <DialTooltip
            tooltip={saveDisabledTooltip}
            hideTooltip={canSubmit || !saveDisabledTooltip}
          >
            <PrimaryButton
              label={saveLabel}
              onClick={handleSubmit}
              disabled={!canSubmit}
            />
          </DialTooltip>
        </div>
      }
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
    </Popup>
  );
};

export default memo(ChatSettingsModal);

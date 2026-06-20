import type { DeploymentFeatures } from '@epam/ai-dial-chat-shared';
import {
  DialFormItem,
  DialInput,
  DialPopup,
  DialPrimaryButton,
  DialSlider,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useState, type FC } from 'react';
import type { ChatSettingsValues } from '../../models/Input';

/** Props for the ChatSettingsModal component. */
export interface ChatSettingsModalProps {
  /** Feature flags for the active deployment — controls which fields are shown. */
  features: DeploymentFeatures;
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
}

export const ChatSettingsModal: FC<ChatSettingsModalProps> = ({
  features,
  initialSystemPrompt,
  initialTemperature,
  onSave,
  onClose,
  title = 'Chat settings',
  systemPromptLabel = 'System prompt',
  systemPromptTooltip = 'Enter a prompt',
  temperatureLabel = 'Temperature',
  temperatureLabels = ['Precise', 'Neutral', 'Creative'],
  temperatureHint,
  saveLabel = 'Apply changes',
}) => {
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [temperature, setTemperature] = useState<number>(initialTemperature);

  const handleSubmit = useCallback(() => {
    const values: ChatSettingsValues = {};
    if (features.systemPrompt) {
      values.systemPrompt = systemPrompt;
    }
    if (features.temperature) {
      values.temperature = temperature;
    }
    onSave(values);
    onClose();
  }, [features, systemPrompt, temperature, onSave, onClose]);

  return (
    <DialPopup
      open
      header={title}
      size={PopupSize.Sm}
      onClose={onClose}
      className="!bg-layer-2"
      footer={
        <div className="flex justify-end px-6 py-4">
          <DialPrimaryButton label={saveLabel} onClick={handleSubmit} />
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        {features.systemPrompt && (
          <DialFormItem
            label={systemPromptLabel}
            labelClassName="!dial-small-text font-semibold !text-primary mb-3"
          >
            <DialInput
              value={systemPrompt}
              placeholder={systemPromptTooltip}
              onChange={(value) => setSystemPrompt(value ?? '')}
            />
          </DialFormItem>
        )}
        {features.temperature && (
          <DialFormItem
            label={temperatureLabel}
            labelClassName="!dial-small-text font-semibold !text-primary"
            description={temperatureHint}
          >
            <DialSlider
              value={temperature}
              min={0}
              max={1}
              step={0.1}
              labels={temperatureLabels}
              onChange={setTemperature}
            />
          </DialFormItem>
        )}
      </div>
    </DialPopup>
  );
};

export default memo(ChatSettingsModal);

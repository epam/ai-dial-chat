import type { DeploymentFeatures } from '@epam/ai-dial-chat-shared';
import {
  DialFormItem,
  DialFormPopup,
  DialNumberInput,
  DialTextarea,
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
  /** Current temperature value pre-populated in the numeric input. */
  initialTemperature: number;
  /** Called with the updated values when the user clicks Save. */
  onSave: (values: ChatSettingsValues) => void;
  /** Called when the modal should close (Save or Cancel). */
  onClose: () => void;
  /** Modal title. Defaults to `'Chat settings'`. */
  title?: string;
  /** Label for the system prompt field. Defaults to `'System prompt'`. */
  systemPromptLabel?: string;
  /** Label for the temperature field. Defaults to `'Temperature'`. */
  temperatureLabel?: string;
  /** Label for the Save button. Defaults to `'Save'`. */
  saveLabel?: string;
  /** Label for the Cancel button. Defaults to `'Cancel'`. */
  cancelLabel?: string;
}

export const ChatSettingsModal: FC<ChatSettingsModalProps> = ({
  features,
  initialSystemPrompt,
  initialTemperature,
  onSave,
  onClose,
  title = 'Chat settings',
  systemPromptLabel = 'System prompt',
  temperatureLabel = 'Temperature',
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
}) => {
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [temperature, setTemperature] = useState<number | string>(
    initialTemperature,
  );

  const handleSubmit = useCallback(() => {
    const values: ChatSettingsValues = {};
    if (features.systemPrompt) {
      values.systemPrompt = systemPrompt;
    }
    if (features.temperature) {
      values.temperature =
        typeof temperature === 'string' ? parseFloat(temperature) : temperature;
    }
    onSave(values);
    onClose();
  }, [features, systemPrompt, temperature, onSave, onClose]);

  return (
    <DialFormPopup
      open
      header={title}
      size={PopupSize.Sm}
      submitLabel={saveLabel}
      cancelLabel={cancelLabel}
      onSubmit={handleSubmit}
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        {features.systemPrompt && (
          <DialFormItem label={systemPromptLabel}>
            <DialTextarea
              value={systemPrompt}
              onChange={(value) => setSystemPrompt(value ?? '')}
            />
          </DialFormItem>
        )}
        {features.temperature && (
          <DialFormItem label={temperatureLabel}>
            <DialNumberInput
              value={
                typeof temperature === 'string'
                  ? parseFloat(temperature)
                  : temperature
              }
              min={0}
              max={1}
              step={0.1}
              onChange={(value) => setTemperature(value ?? 0)}
            />
          </DialFormItem>
        )}
      </div>
    </DialFormPopup>
  );
};

export default memo(ChatSettingsModal);

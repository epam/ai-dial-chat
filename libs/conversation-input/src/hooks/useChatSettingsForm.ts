import { ResponseFormat } from '@epam/ai-dial-chat-shared';
import type { DeploymentFeatures } from '@epam/ai-dial-chat-shared';
import { useCallback, useState } from 'react';
import type { ChatSettingsValues } from '../models/Input';

interface UseChatSettingsFormParams {
  /** Feature flags controlling which fields are included on submit. */
  features: DeploymentFeatures;
  initialResponseFormat: ResponseFormat;
  initialSystemPrompt: string;
  initialTemperature: number;
  onSave: (values: ChatSettingsValues) => void;
  /** Called after a successful save. */
  onClose: () => void;
}

/** Manages form state and the submit handler for chat settings. */
export const useChatSettingsForm = ({
  features,
  initialResponseFormat,
  initialSystemPrompt,
  initialTemperature,
  onSave,
  onClose,
}: UseChatSettingsFormParams) => {
  const [responseFormat, setResponseFormat] =
    useState<ResponseFormat>(initialResponseFormat);
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [temperature, setTemperature] = useState<number>(initialTemperature);

  const handleSubmit = useCallback(() => {
    const values: ChatSettingsValues = {};
    if (features.responseFormat) values.responseFormat = responseFormat;
    if (features.systemPrompt) values.systemPrompt = systemPrompt;
    if (features.temperature) values.temperature = temperature;
    onSave(values);
    onClose();
  }, [features, responseFormat, systemPrompt, temperature, onSave, onClose]);

  return {
    responseFormat,
    systemPrompt,
    temperature,
    setResponseFormat,
    setSystemPrompt,
    setTemperature,
    handleSubmit,
  };
};

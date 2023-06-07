import { useTranslation } from 'next-i18next';

import { Conversation } from '@/types/chat';
import { Prompt } from '@/types/prompt';

import { ModelSelect } from './ModelSelect';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

interface Props {
  conversation: Conversation;
  prompts: Prompt[];
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
}

export const ChatEmptySettings = ({
  conversation,
  prompts,
  onChangePrompt,
  onChangeTemperature,
}: Props) => {
  const { t } = useTranslation('chat');

  return (
    <div className="flex h-full flex-col space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-600">
      <ModelSelect />

      <SystemPrompt
        conversation={conversation}
        prompts={prompts}
        onChangePrompt={onChangePrompt}
      />

      <TemperatureSlider
        label={t('Temperature')}
        onChangeTemperature={onChangeTemperature}
      />
    </div>
  );
};

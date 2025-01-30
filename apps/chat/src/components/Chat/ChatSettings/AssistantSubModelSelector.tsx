import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { ModelsSelector } from '@/src/components/Common/ModelsSelector';

interface Props {
  assistantModelId: string;
  onSelectAssistantSubModel: (modelId: string) => void;
  disabled?: boolean;
}

export const AssistantSubModelSelector = ({
  assistantModelId,
  onSelectAssistantSubModel,
  disabled,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <>
      <label className="mb-4 inline-block text-left">{t('Model')}</label>
      <ModelsSelector
        value={assistantModelId}
        onChange={onSelectAssistantSubModel}
        disabled={disabled}
      />
    </>
  );
};

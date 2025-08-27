import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ModelsSelector } from '@/src/components/Common/ModelsSelector';

interface Props {
  assistantModelReference: string;
  onSelectAssistantSubModel: (modelId: string) => void;
  disabled?: boolean;
}

export const AssistantSubModelSelector = ({
  assistantModelReference,
  onSelectAssistantSubModel,
  disabled,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <>
      <label className="mb-4 inline-block text-left">{t('Model')}</label>
      <ModelsSelector
        value={assistantModelReference}
        onChange={onSelectAssistantSubModel}
        disabled={disabled}
      />
    </>
  );
};

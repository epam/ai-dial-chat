import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { OpenAIEntityModel } from '@/src/types/openai';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { Combobox } from '../Common/Combobox';
import { ModelSelectRow, SettingContainer } from './ConversationSettings';

interface Props {
  assistantModelId: string;
  onSelectAssistantSubModel: (modelId: string) => void;
}

export const AssistantSubModelSelector = ({
  assistantModelId,
  onSelectAssistantSubModel,
}: Props) => {
  const { t } = useTranslation('chat');
  const modelsModels = useAppSelector(ModelsSelectors.selectModelsOnly);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const assistantSubModel = useMemo(
    () => modelsMap[assistantModelId],
    [assistantModelId, modelsMap],
  );
  return (
    <SettingContainer>
      <label className="mb-4 inline-block text-left">{t('Model')}</label>
      <Combobox
        items={modelsModels}
        initialSelectedItem={assistantSubModel}
        getItemLabel={(model: OpenAIEntityModel) => model.name || model.id}
        getItemValue={(model: OpenAIEntityModel) => model.id}
        itemRow={ModelSelectRow}
        onSelectItem={(itemID: string) => {
          onSelectAssistantSubModel(itemID);
        }}
      />
    </SettingContainer>
  );
};

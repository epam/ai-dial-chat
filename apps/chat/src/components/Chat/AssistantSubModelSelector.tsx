import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { OpenAIEntityModel } from '@/src/types/openai';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { Combobox } from '../Common/Combobox';
import { DisableOverlay } from '../Common/DisableOverlay';
import { ModelSelectRow } from './ConversationSettings';

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
  const onlyModels = useAppSelector(ModelsSelectors.selectModelsOnly);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const assistantSubModel = useMemo(
    () => modelsMap[assistantModelId],
    [assistantModelId, modelsMap],
  );

  return (
    <>
      <label className="mb-4 inline-block text-left">{t('Model')}</label>
      <div className="relative">
        {disabled && <DisableOverlay />}
        <Combobox
          items={onlyModels}
          initialSelectedItem={assistantSubModel}
          getItemLabel={(model: OpenAIEntityModel) => model.name || model.id}
          getItemValue={(model: OpenAIEntityModel) => model.id}
          itemRow={ModelSelectRow}
          onSelectItem={(itemID: string) => {
            onSelectAssistantSubModel(itemID);
          }}
        />
      </div>
    </>
  );
};

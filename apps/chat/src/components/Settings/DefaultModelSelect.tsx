import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ModelsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import {
  DefaultModel,
  LastUsedModel,
  SPECIAL_DEFAULT_MODEL_DIC,
} from '@/src/constants/chat';

import { ModelsSelector } from '@/src/components/Common/ModelsSelector';

export const DefaultModelSelect = () => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Settings);
  const model = useAppSelector(ModelsSelectors.selectDefaultModelOption);
  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const allModels = useMemo(
    () => [DefaultModel, LastUsedModel, ...models],
    [models],
  );

  const selectedModel =
    modelsMap[model] ?? SPECIAL_DEFAULT_MODEL_DIC[model] ?? DefaultModel;

  const onChangeHandler = (modelId: string) => {
    dispatch(ModelsActions.setDefaultModelReference(modelId));
  };

  return (
    <div className="flex items-center gap-5" data-qa="default-model">
      <span className="basis-1/3 md:basis-1/4">{t('Start chat with')}</span>
      <div className="flex h-[38px] max-w-[331px] grow basis-2/3 items-center gap-8 overflow-hidden rounded border border-primary focus-within:!border-primary focus:!border-primary md:basis-3/4">
        <ModelsSelector
          value={selectedModel.id}
          onChange={onChangeHandler}
          models={allModels}
          additionalModelsMap={SPECIAL_DEFAULT_MODEL_DIC}
          useReference
        />
      </div>
    </div>
  );
};

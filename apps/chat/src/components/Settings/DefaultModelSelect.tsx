import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import {
  DEFAULT_MODEL_OPTION,
  LAST_USED_MODEL_OPTION,
  SPECIAL_DEFAULT_MODEL_DIC,
} from '@/src/constants/chat';

import { ModelsSelector } from '@/src/components/Common/ModelsSelector';

interface DefaultModelSelectProps {
  modelReference: string;
  onModelChange: (modelReference: string) => void;
}

export const DefaultModelSelect = ({
  modelReference,
  onModelChange,
}: DefaultModelSelectProps) => {
  const { t } = useTranslation(Translation.Settings);

  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const selectedModel = useMemo(
    () =>
      modelsMap[modelReference] ??
      SPECIAL_DEFAULT_MODEL_DIC[modelReference] ??
      DEFAULT_MODEL_OPTION,
    [modelReference, modelsMap],
  );

  const selected = modelsMap[modelReference];

  const allModels = useMemo(() => {
    const selected = modelsMap[modelReference];
    if (!selected)
      return [DEFAULT_MODEL_OPTION, LAST_USED_MODEL_OPTION, ...models];
    const filteredModels = models.filter(
      (mod) => !selected || mod.reference !== selected.reference,
    );
    return [
      DEFAULT_MODEL_OPTION,
      LAST_USED_MODEL_OPTION,
      selected,
      ...filteredModels,
    ];
  }, [modelReference, models, modelsMap]);

  return (
    <div className="flex items-center gap-5" data-qa="default-model">
      <span className="basis-1/3 md:basis-1/4">{t('Start chat with')}</span>
      <div className="flex h-[38px] max-w-[331px] grow basis-2/3 items-center gap-8 overflow-hidden rounded border-y border-primary md:basis-3/4">
        <ModelsSelector
          value={selectedModel.id}
          onChange={onModelChange}
          models={allModels}
          indexSeparator={selected ? 2 : 1}
          additionalModelsMap={SPECIAL_DEFAULT_MODEL_DIC}
          useReference
          inputClassName="focus-within:!border-primary"
          panelClassName="!bg-layer-0"
        />
      </div>
    </div>
  );
};

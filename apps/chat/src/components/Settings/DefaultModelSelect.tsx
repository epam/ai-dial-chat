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

import { Label } from '@/src/components/Common/Forms/Label';
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
    <div className="flex flex-col" data-qa="default-model">
      <Label>{t('Start chat with')}</Label>
      <div className="flex h-[38px] grow items-center gap-8 overflow-hidden rounded border-y border-primary">
        <ModelsSelector
          value={selectedModel.id}
          onChange={onModelChange}
          models={allModels}
          indexSeparator={selected ? 2 : 1}
          additionalModelsMap={SPECIAL_DEFAULT_MODEL_DIC}
          inputClassName="focus-within:!border-primary"
          panelClassName="!bg-layer-0"
        />
      </div>
    </div>
  );
};

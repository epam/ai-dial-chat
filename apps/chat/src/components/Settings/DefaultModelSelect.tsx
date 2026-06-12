import { useCallback, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { DialAIEntityModel, ModelsMap } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import {
  DEFAULT_AGENT,
  DEFAULT_MODEL_OPTION,
  LAST_USED_AGENT,
  LAST_USED_MODEL_OPTION,
} from '@/src/constants/chat';
import { ChatI18nKeys, SettingsI18nKeys } from '@/src/constants/i18n';

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
  const { t: tChat } = useTranslation(Translation.Chat);

  const localizeSpecialModel = useCallback(
    (model: DialAIEntityModel) => {
      if (model.id === DEFAULT_AGENT) {
        return {
          ...model,
          name: tChat(ChatI18nKeys.DefaultAgent),
        };
      }

      if (model.id === LAST_USED_AGENT) {
        return {
          ...model,
          name: tChat(ChatI18nKeys.LastUsedAgent),
        };
      }

      return model;
    },
    [tChat],
  );

  const localizedDefaultModelOption = useMemo(
    () => localizeSpecialModel(DEFAULT_MODEL_OPTION),
    [localizeSpecialModel],
  );
  const localizedLastUsedModelOption = useMemo(
    () => localizeSpecialModel(LAST_USED_MODEL_OPTION),
    [localizeSpecialModel],
  );
  const localizedSpecialModelsMap = useMemo<ModelsMap>(
    () => ({
      [DEFAULT_AGENT]: localizedDefaultModelOption,
      [LAST_USED_AGENT]: localizedLastUsedModelOption,
    }),
    [localizedDefaultModelOption, localizedLastUsedModelOption],
  );

  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const selectedModel = useMemo(
    () =>
      modelsMap[modelReference] ??
      localizedSpecialModelsMap[modelReference] ??
      localizedDefaultModelOption,
    [
      localizedDefaultModelOption,
      localizedSpecialModelsMap,
      modelReference,
      modelsMap,
    ],
  );

  const selected = modelsMap[modelReference];

  const allModels = useMemo(() => {
    const selected = modelsMap[modelReference];
    if (!selected) {
      return [
        localizedDefaultModelOption,
        localizedLastUsedModelOption,
        ...models,
      ];
    }
    const filteredModels = models.filter(
      (mod) => !selected || mod.reference !== selected.reference,
    );
    return [
      localizedDefaultModelOption,
      localizedLastUsedModelOption,
      selected,
      ...filteredModels,
    ];
  }, [
    localizedDefaultModelOption,
    localizedLastUsedModelOption,
    modelReference,
    models,
    modelsMap,
  ]);

  return (
    <div className="flex flex-col" data-qa="default-model">
      <Label>{t(SettingsI18nKeys.StartChatWith)}</Label>
      <div className="flex h-[38px] grow items-center gap-8 overflow-hidden rounded border-y border-primary">
        <ModelsSelector
          value={selectedModel.id}
          onChange={onModelChange}
          models={allModels}
          indexSeparator={selected ? 2 : 1}
          additionalModelsMap={localizedSpecialModelsMap}
          inputClassName="focus-within:!border-primary"
          panelClassName="!bg-layer-0"
        />
      </div>
    </div>
  );
};

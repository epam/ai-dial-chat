import { useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { OpenAIEntityModel } from '@/src/types/openai';
import { Prompt } from '@/src/types/prompt';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import XMark from '../../../public/images/icons/xmark.svg';
import { Combobox } from '../Common/Combobox';
import { Addons } from './Addons';
import { ConversationSettingsModel } from './ConversationSettingsModels';
import { ModelDescription } from './ModelDescription';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

import { DEFAULT_ASSISTANT_SUBMODEL } from '@/src/constants/default-settings';

interface ModelSelectRowProps {
  item: OpenAIEntityModel;
}

const ModelSelectRow = ({ item }: ModelSelectRowProps) => {
  const theme = useAppSelector(UISelectors.selectThemeState);

  return (
    <div className="flex items-center gap-2">
      <ModelIcon
        entity={item}
        entityId={item.id}
        size={18}
        inverted={theme === 'dark'}
      />
      <span>{item.name || item.id}</span>
    </div>
  );
};

interface Props {
  model: OpenAIEntityModel | undefined;
  assistantModelId: string | undefined;
  prompt: string | undefined;
  temperature: number | undefined;
  prompts: Prompt[];
  selectedAddons: string[];
  isApplyEnabled?: boolean;
  isCloseEnabled?: boolean;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
  onApplyAddons: (addonsIds: string[]) => void;
  onChangeAddon: (addonsId: string) => void;
  onApplySettings?: () => void;
  onClose?: () => void;
}

export const ConversationSettings = ({
  model,
  assistantModelId,
  prompts,
  prompt,
  temperature,
  selectedAddons,
  isApplyEnabled,
  isCloseEnabled,
  onClose,
  onSelectModel,
  onSelectAssistantSubModel,
  onChangePrompt,
  onChangeTemperature,
  onChangeAddon,
  onApplyAddons,
  onApplySettings,
}: Props) => {
  const { t } = useTranslation('chat');
  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const [assistantSubModel, setAssistantSubModel] = useState(() => {
    return modelsMap[assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id];
  });

  useEffect(() => {
    setAssistantSubModel(
      modelsMap[assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id],
    );
  }, [assistantModelId, modelsMap]);

  return (
    <div className="flex w-full flex-col gap-[1px] overflow-hidden rounded-b bg-gray-300 dark:bg-gray-900 [&:first-child]:rounded-t">
      <div
        className="relative grid w-full gap-[1px] xl:grid-cols-2"
        data-qa="conversation-settings"
      >
        <div className="shrink overflow-auto bg-gray-200 px-5 py-4 dark:bg-gray-800">
          <ConversationSettingsModel
            modelId={model?.id}
            onModelSelect={onSelectModel}
          />
        </div>
        {model ? (
          <div
            className="flex max-h-full shrink flex-col gap-[1px] overflow-auto"
            data-qa="entity-settings"
          >
            {model.type === 'application' && (
              <div className="grow bg-gray-200 px-5 py-4 dark:bg-gray-800">
                <ModelDescription model={model} />
              </div>
            )}
            {model.type === 'assistant' && assistantSubModel && (
              <div className="grow bg-gray-200 px-5 py-4 dark:bg-gray-800">
                <label className="mb-4 inline-block text-left">
                  {t('Model')}
                </label>
                <Combobox
                  items={models.filter((model) => model.type === 'model')}
                  initialSelectedItem={assistantSubModel}
                  getItemLabel={(model: OpenAIEntityModel) =>
                    model.name || model.id
                  }
                  getItemValue={(model: OpenAIEntityModel) => model.id}
                  itemRow={ModelSelectRow}
                  onSelectItem={(itemID: string) => {
                    onSelectAssistantSubModel(itemID);
                  }}
                />
              </div>
            )}
            {model.type === 'model' && (
              <div className="grow bg-gray-200 px-5 py-4 dark:bg-gray-800">
                <SystemPrompt
                  model={model}
                  prompt={prompt}
                  prompts={prompts}
                  onChangePrompt={onChangePrompt}
                />
              </div>
            )}

            {model.type !== 'application' && (
              <div className="grow bg-gray-200 px-5 py-4 dark:bg-gray-800">
                <TemperatureSlider
                  label={t('Temperature')}
                  onChangeTemperature={onChangeTemperature}
                  temperature={temperature}
                />
              </div>
            )}

            {model.type !== 'application' && (
              <div className="grow bg-gray-200 px-5 py-4 dark:bg-gray-800">
                <Addons
                  preselectedAddonsIds={model.selectedAddons || []}
                  selectedAddonsIds={selectedAddons}
                  onChangeAddon={onChangeAddon}
                  onApplyAddons={onApplyAddons}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center p-3">
            {t('No settings available')}
          </div>
        )}
        {isCloseEnabled && (
          <button
            className="absolute right-3 top-3 text-gray-500 hover:text-blue-500"
            onClick={onClose}
          >
            <XMark height={24} width={24} />
          </button>
        )}
      </div>
      {isApplyEnabled && onApplySettings && (
        <div className="flex items-center justify-center overflow-hidden bg-gray-200 px-5 py-4 dark:bg-gray-800">
          <button
            className="rounded bg-blue-500 px-3 py-2.5 text-gray-100 hover:bg-blue-700"
            onClick={() => {
              onClose?.();
              onApplySettings();
            }}
          >
            {t('Apply changes')}
          </button>
        </div>
      )}
    </div>
  );
};

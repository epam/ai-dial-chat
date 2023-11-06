import { useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Replay } from '@/src/types/chat';
import { OpenAIEntityModel } from '@/src/types/openai';
import { Prompt } from '@/src/types/prompt';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { DEFAULT_ASSISTANT_SUBMODEL } from '@/src/constants/default-settings';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import XMark from '../../../public/images/icons/xmark.svg';
import { Combobox } from '../Common/Combobox';
import { Addons } from './Addons';
import { ConversationSettingsModel } from './ConversationSettingsModels';
import { ModelDescription } from './ModelDescription';
import { ReplayAsIsDescription } from './ReplayAsIsDescription';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

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
  conversationId: string;
  replay: Replay;
  isCloseEnabled?: boolean;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
  onApplyAddons: (addonsIds: string[]) => void;
  onChangeAddon: (addonsId: string) => void;
  onClose?: () => void;
}

export const ConversationSettings = ({
  model,
  assistantModelId,
  prompts,
  prompt,
  temperature,
  selectedAddons,
  isCloseEnabled,
  conversationId,
  replay,
  onClose,
  onSelectModel,
  onSelectAssistantSubModel,
  onChangePrompt,
  onChangeTemperature,
  onChangeAddon,
  onApplyAddons,
}: Props) => {
  const { t } = useTranslation('chat');
  const models = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const [assistantSubModel, setAssistantSubModel] = useState(() => {
    return modelsMap[assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id];
  });
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  const isNoModelInUserMessages = useMemo(() => {
    return (
      replay.isReplay &&
      replay.replayUserMessagesStack &&
      replay.replayUserMessagesStack.some((message) => !message.model)
    );
  }, [replay]);
  useEffect(() => {
    setAssistantSubModel(
      modelsMap[assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id],
    );
  }, [assistantModelId, modelsMap]);

  useEffect(() => {
    if (!ref) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      ref.current?.clientWidth && setWidth(ref.current.clientWidth);
    });
    ref.current && resizeObserver.observe(ref.current);

    () => {
      resizeObserver.disconnect();
    };
  }, [ref]);

  return (
    <div
      ref={ref}
      className="flex w-full flex-col gap-[1px] overflow-hidden rounded-b bg-gray-300 dark:bg-gray-900 [&:first-child]:rounded-t"
    >
      <div
        className={classNames(
          'relative h-full w-full gap-[1px] overflow-auto',
          {
            'grid grid-cols-2': width >= 450,
          },
        )}
        data-qa="conversation-settings"
      >
        <div className="shrink overflow-auto bg-gray-200 px-3 py-4 dark:bg-gray-800 md:px-5">
          <ConversationSettingsModel
            conversationId={conversationId}
            replay={replay}
            modelId={model?.id}
            onModelSelect={onSelectModel}
          />
        </div>
        {!replay.replayAsIs ? (
          model ? (
            <div
              className="flex max-h-full shrink flex-col divide-y divide-gray-300 overflow-auto bg-gray-200 dark:divide-gray-900 dark:bg-gray-800"
              data-qa="entity-settings"
            >
              {model.type === 'application' && (
                <div className="grow px-3 py-4 md:px-5">
                  <ModelDescription model={model} />
                </div>
              )}
              {model.type === 'assistant' && assistantSubModel && (
                <div className="grow px-3 py-4 md:px-5">
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
                <div className="grow px-3 py-4 md:px-5">
                  <SystemPrompt
                    model={model}
                    prompt={prompt}
                    prompts={prompts}
                    onChangePrompt={onChangePrompt}
                  />
                </div>
              )}

              {model.type !== 'application' && (
                <div className="grow px-3 py-4 md:px-5">
                  <TemperatureSlider
                    label={t('Temperature')}
                    onChangeTemperature={onChangeTemperature}
                    temperature={temperature}
                  />
                </div>
              )}

              {model.type !== 'application' && (
                <div className="grow px-3 py-4 md:px-5">
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
          )
        ) : (
          <div className="flex max-h-full shrink flex-col overflow-auto">
            <ReplayAsIsDescription
              isModelInMessages={isNoModelInUserMessages}
            />
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
    </div>
  );
};

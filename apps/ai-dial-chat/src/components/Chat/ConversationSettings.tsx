import { IconX } from '@tabler/icons-react';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Replay } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { OpenAIEntityModel } from '@/src/types/openai';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { DEFAULT_ASSISTANT_SUBMODEL } from '@/src/constants/default-settings';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { Addons } from './Addons';
import { AssistantSubModelSelector } from './AssistantSubModelSelector';
import { ConversationSettingsModel } from './ConversationSettingsModels';
import { ModelDescription } from './ModelDescription';
import { ReplayAsIsDescription } from './ReplayAsIsDescription';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

interface ModelSelectRowProps {
  item: OpenAIEntityModel;
}

interface SettingContainerProps {
  children: ReactNode;
}

interface Props {
  modelId: string | undefined;
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

export const ModelSelectRow = ({ item }: ModelSelectRowProps) => {
  return (
    <div className="flex items-center gap-2">
      <ModelIcon entity={item} entityId={item.id} size={18} />
      <span>{item.name || item.id}</span>
    </div>
  );
};

export const SettingContainer = ({ children }: SettingContainerProps) => (
  <div className="grow px-3 py-4 md:px-5">{children}</div>
);

export const ConversationSettings = ({
  modelId,
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
  const { t } = useTranslation(Translation.Chat);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const model = useMemo(
    () => (modelId ? modelsMap[modelId] : undefined),
    [modelId, modelsMap],
  );

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
    if (!ref) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      ref.current?.clientWidth && setWidth(ref.current.clientWidth);
    });
    ref.current && resizeObserver.observe(ref.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [ref]);

  return (
    <div
      ref={ref}
      className="flex w-full flex-col gap-[1px] overflow-hidden rounded-b bg-layer-1 [&:first-child]:rounded-t"
    >
      <div
        className={classNames('relative size-full gap-[1px] overflow-auto', {
          'grid grid-cols-2 grid-rows-1': width >= 450,
        })}
        data-qa="conversation-settings"
      >
        <div className="shrink overflow-auto bg-layer-2 px-3 py-4 md:px-5">
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
              className="flex max-h-full shrink flex-col divide-y divide-tertiary overflow-auto bg-layer-2"
              data-qa="entity-settings"
            >
              {model.type === EntityType.Application && (
                <SettingContainer>
                  <ModelDescription model={model} />
                </SettingContainer>
              )}
              {model.type === EntityType.Assistant && (
                <SettingContainer>
                  <AssistantSubModelSelector
                    assistantModelId={
                      assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id
                    }
                    onSelectAssistantSubModel={onSelectAssistantSubModel}
                  />
                </SettingContainer>
              )}
              {model.type === EntityType.Model && (
                <SettingContainer>
                  <SystemPrompt
                    maxLength={model.maxLength}
                    prompt={prompt}
                    prompts={prompts}
                    onChangePrompt={onChangePrompt}
                  />
                </SettingContainer>
              )}

              {model.type !== EntityType.Application && (
                <SettingContainer>
                  <TemperatureSlider
                    label={t('Temperature')}
                    onChangeTemperature={onChangeTemperature}
                    temperature={temperature}
                  />
                </SettingContainer>
              )}

              {model.type !== EntityType.Application && (
                <SettingContainer>
                  <Addons
                    preselectedAddonsIds={model.selectedAddons || []}
                    selectedAddonsIds={selectedAddons}
                    onChangeAddon={onChangeAddon}
                    onApplyAddons={onApplyAddons}
                  />
                </SettingContainer>
              )}
            </div>
          ) : (
            <div className="flex justify-center p-3">
              {t('No settings available')}
            </div>
          )
        ) : (
          <ReplayAsIsDescription isModelInMessages={isNoModelInUserMessages} />
        )}
        {isCloseEnabled && (
          <button
            className="absolute right-3 top-3 text-secondary hover:text-accent-primary"
            onClick={onClose}
          >
            <IconX height={24} width={24} />
          </button>
        )}
      </div>
    </div>
  );
};

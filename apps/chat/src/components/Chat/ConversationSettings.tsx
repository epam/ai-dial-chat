import { IconX } from '@tabler/icons-react';
import { ReactNode, useEffect, useMemo, useRef } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';
import { isPseudoModel } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import {
  MIN_TWO_CAL_CHAT_SETTINGS_WIDTH,
  REPLAY_AS_IS_MODEL,
} from '@/src/constants/chat';
import { DEFAULT_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { Addons } from './Addons';
import { AssistantSubModelSelector } from './AssistantSubModelSelector';
import { ConversationSettingsModel } from './ConversationSettingsModels';
import { ModelDescription } from './ModelDescription';
import { ReplayAsIsDescription } from './ReplayAsIsDescription';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

interface ModelSelectRowProps {
  item: DialAIEntityModel;
  isNotAllowed: boolean;
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
  conversation: Conversation;
  isCloseEnabled?: boolean;
  onChangePrompt: (prompt: string) => void;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
  onSelectAssistantSubModel: (modelId: string) => void;
  onApplyAddons: (addonsIds: string[]) => void;
  onChangeAddon: (addonsId: string) => void;
  onClose?: () => void;
  debounceSystemPromptChanges?: boolean;
}

export const ModelSelectRow = ({ item, isNotAllowed }: ModelSelectRowProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div
      className={classNames(
        'flex items-center gap-2',
        isNotAllowed && 'text-secondary-bg-light',
      )}
    >
      <ModelIcon entity={item} entityId={item.id} size={18} />
      <div>
        <span>{getOpenAIEntityFullName(item)}</span>
        {isNotAllowed && (
          <span className="text-error" data-qa="group-entity-descr">
            <EntityMarkdownDescription isShortDescription>
              {t('chat.error.incorrect-selected', {
                context: EntityType.Model,
              })}
            </EntityMarkdownDescription>
          </span>
        )}
      </div>
    </div>
  );
};

export const SettingContainer = ({ children }: SettingContainerProps) => {
  if (!children) {
    return null;
  }

  return <div className="px-3 py-4 md:px-5">{children}</div>;
};

export const ConversationSettings = ({
  modelId,
  assistantModelId,
  prompts,
  prompt,
  temperature,
  selectedAddons,
  isCloseEnabled,
  conversation,
  onClose,
  onSelectModel,
  onSelectAssistantSubModel,
  onChangePrompt,
  onChangeTemperature,
  onChangeAddon,
  onApplyAddons,
  debounceSystemPromptChanges = false,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const settingsWidth = useAppSelector(UISelectors.selectChatSettingsWidth);

  const settingsRef = useRef<HTMLDivElement>(null);

  const model = useMemo(
    () => (modelId ? modelsMap[modelId] : undefined),
    [modelId, modelsMap],
  );

  const isNoModelInUserMessages = useMemo(() => {
    return (
      conversation.replay &&
      conversation.replay.isReplay &&
      conversation.replay.replayUserMessagesStack &&
      conversation.replay.replayUserMessagesStack.some(
        (message) => !message.model,
      )
    );
  }, [conversation.replay]);

  const isPlayback = conversation.playback?.isPlayback;

  useEffect(() => {
    if (!settingsRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      if (
        settingsRef?.current?.offsetWidth &&
        settingsRef?.current?.offsetWidth !== settingsWidth
      ) {
        dispatch(
          UIActions.setChatSettingsWidth(settingsRef.current.offsetWidth),
        );
      }
    });

    resizeObserver.observe(settingsRef.current);

    return function cleanup() {
      resizeObserver.disconnect();
    };
  }, [settingsWidth, settingsRef, dispatch]);

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-b-primary bg-layer-1 shadow-primary">
      <div
        ref={settingsRef}
        className={classNames(
          'relative size-full divide-x divide-secondary overflow-auto',
          settingsWidth &&
            settingsWidth >= MIN_TWO_CAL_CHAT_SETTINGS_WIDTH &&
            'md:grid md:grid-cols-3 md:grid-rows-1',
        )}
        data-qa="conversation-settings"
      >
        <div className="shrink overflow-auto bg-layer-2 px-3 py-4 md:px-5">
          <ConversationSettingsModel
            conversation={conversation}
            modelId={model?.id}
            unavailableModelId={
              !model?.id && !isPseudoModel(modelId) ? modelId : undefined
            }
            onModelSelect={(modelId: string) => {
              onSelectModel(modelId);
            }}
          />
        </div>
        <div
          className="col-span-2 flex shrink flex-col divide-y divide-secondary overflow-auto bg-layer-2"
          data-qa="entity-settings"
        >
          {modelId !== REPLAY_AS_IS_MODEL ? (
            <>
              {model && model.type === EntityType.Application && (
                <SettingContainer>
                  <ModelDescription model={model} />
                </SettingContainer>
              )}
              {model && model.type === EntityType.Assistant && (
                <SettingContainer>
                  <AssistantSubModelSelector
                    assistantModelId={
                      assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL_ID
                    }
                    onSelectAssistantSubModel={onSelectAssistantSubModel}
                    disabled={isPlayback}
                  />
                </SettingContainer>
              )}
              {(!model ||
                (model.type === EntityType.Model &&
                  model?.features?.systemPrompt)) && (
                <SettingContainer>
                  <SystemPrompt
                    maxTokensLength={
                      model?.limits?.maxRequestTokens ?? Infinity
                    }
                    tokenizer={model?.tokenizer}
                    prompt={prompt}
                    prompts={prompts}
                    onChangePrompt={onChangePrompt}
                    debounceChanges={debounceSystemPromptChanges}
                    disabled={isPlayback}
                  />
                </SettingContainer>
              )}
              {(!model || model.type !== EntityType.Application) && (
                <SettingContainer>
                  <TemperatureSlider
                    label={t('Temperature')}
                    onChangeTemperature={onChangeTemperature}
                    temperature={temperature}
                    disabled={isPlayback}
                  />
                </SettingContainer>
              )}
              {/*{(!model || model.type !== EntityType.Application) && (*/}
              <SettingContainer>
                <Addons
                  preselectedAddonsIds={model?.selectedAddons || []}
                  selectedAddonsIds={selectedAddons}
                  onChangeAddon={onChangeAddon}
                  onApplyAddons={onApplyAddons}
                  disabled={isPlayback}
                />
              </SettingContainer>
              {/*)}*/}
            </>
          ) : (
            <ReplayAsIsDescription
              isModelInMessages={isNoModelInUserMessages}
            />
          )}
        </div>
        {isCloseEnabled && (
          <button
            className="absolute right-3 top-3 text-secondary-bg-dark hover:text-pr-primary-700"
            onClick={onClose}
          >
            <IconX height={24} width={24} />
          </button>
        )}
      </div>
    </div>
  );
};

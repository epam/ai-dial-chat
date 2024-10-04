import { IconX } from '@tabler/icons-react';
import { ReactNode, useEffect, useMemo, useRef } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';
import { DefaultsService } from '@/src/utils/app/data/defaults-service';
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
import { FALLBACK_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

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
        isNotAllowed && 'text-secondary',
      )}
    >
      <ModelIcon entity={item} entityId={item.id} size={18} />
      <div>
        <span>{getOpenAIEntityFullName(item)}</span>
        {isNotAllowed && (
          <span className="text-error" data-qa="talk-to-entity-descr">
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

  return <div className="px-3 py-4 md:pl-5 md:pr-6">{children}</div>;
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
  const recentModelsIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);
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
    <>
      <div
        ref={settingsRef}
        className={classNames(
          'relative flex size-full flex-col divide-x divide-tertiary overflow-auto rounded border-t-[1px] border-tertiary',
          settingsWidth &&
            settingsWidth >= MIN_TWO_CAL_CHAT_SETTINGS_WIDTH &&
            'md:grid md:grid-cols-2 md:grid-rows-1',
        )}
        data-qa="conversation-settings"
      >
        <div className="shrink bg-layer-2 px-3 py-4 md:px-6">
          <ConversationSettingsModel
            conversation={conversation}
            modelId={
              model?.reference ??
              (!isPseudoModel(modelId) ? modelId : recentModelsIds[0])
            }
            isModelUnavailable={!model?.id && !isPseudoModel(modelId)}
            onModelSelect={onSelectModel}
          />
        </div>
        <div
          className="flex shrink flex-col divide-y divide-tertiary bg-layer-2 md:overflow-auto"
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
                      assistantModelId ??
                      DefaultsService.get('assistantSubmodelId') ??
                      FALLBACK_ASSISTANT_SUBMODEL_ID
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
                    label={t('Temperature') ?? ''}
                    onChangeTemperature={onChangeTemperature}
                    temperature={temperature}
                    disabled={isPlayback}
                  />
                </SettingContainer>
              )}
              {(!model || model.type !== EntityType.Application) && (
                <SettingContainer>
                  <Addons
                    preselectedAddonsIds={model?.selectedAddons || []}
                    selectedAddonsIds={selectedAddons}
                    onChangeAddon={onChangeAddon}
                    onApplyAddons={onApplyAddons}
                    disabled={isPlayback}
                  />
                </SettingContainer>
              )}
            </>
          ) : (
            <ReplayAsIsDescription
              isModelInMessages={isNoModelInUserMessages}
            />
          )}
        </div>
      </div>

      {isCloseEnabled && (
        <button
          className="absolute right-3 top-3 text-secondary hover:text-accent-primary"
          onClick={onClose}
        >
          <IconX height={24} width={24} />
        </button>
      )}
    </>
  );
};

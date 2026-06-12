import { useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getModelDescription } from '@/src/utils/app/application';
import {
  getOpenAIEntityFullName,
  isOldConversationReplay,
  isPlaybackConversation,
  isReplayAsIsConversation,
} from '@/src/utils/app/conversation';
import { isEntityIdExternal } from '@/src/utils/app/id';
import { getGroupMarketplaceEntityKey } from '@/src/utils/app/marketplace';
import { isEntityReadOnly } from '@/src/utils/app/permissions';

import { Conversation } from '@/src/types/chat';
import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors, SettingsSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { Spinner } from '@/src/components/Common/Spinner';
import { FunctionStatusIndicator } from '@/src/components/Marketplace/FunctionStatusIndicator';

import { ModelVersionSelect } from './ModelVersionSelect';
import { PlaybackIcon } from './Playback/PlaybackIcon';
import { ReplayAsIsIcon } from './ReplayAsIsIcon';

import { Feature } from '@epam/ai-dial-shared';
import { DialLinkButton } from '@epam/ai-dial-ui-kit';

interface EmptyChatDescriptionViewProps {
  conversation: Conversation;
  onShowChangeModel: (conversationId: string) => void;
  onShowSettings: (show: boolean) => void;
  isApplicationPreviewChat: boolean;
}

const getModelName = (
  conversation: Conversation,
  model: DialAIEntityModel | undefined,
) => {
  if (isPlaybackConversation(conversation)) {
    return 'Playback';
  }

  if (isReplayAsIsConversation(conversation)) {
    return 'Replay as is';
  }

  if (model) {
    return getOpenAIEntityFullName(model);
  }

  return conversation.model.id;
};

const EmptyChatDescriptionView = ({
  conversation,
  onShowChangeModel,
  onShowSettings,
  isApplicationPreviewChat,
}: EmptyChatDescriptionViewProps) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const models = useAppSelector(ModelsSelectors.selectModels);
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const isIsolatedView = useAppSelector(SettingsSelectors.selectIsIsolatedView);
  const isOptimisticDefaultModelLoad = useAppSelector(
    SettingsSelectors.selectIsOptimisticDefaultModelLoad,
  );

  const screenState = useScreenState();

  const model = modelsMap[conversation.model.id];
  const versions = useMemo(
    () =>
      model
        ? models.filter(
            (m: DialAIEntityModel) =>
              (installedModelIds.has(m.reference) ||
                model.reference === m.reference) &&
              getGroupMarketplaceEntityKey(m) ===
                getGroupMarketplaceEntityKey(model),
          )
        : [],
    [installedModelIds, model, models],
  );

  const handleOpenChangeModel = useCallback(
    () => onShowChangeModel(conversation.id),
    [conversation.id, onShowChangeModel],
  );

  const handleOpenSettings = useCallback(
    () => onShowSettings(true),
    [onShowSettings],
  );

  const handleSelectVersion = useCallback(
    (model: DialAIEntityModel) => {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { model: { id: model.reference } },
        }),
      );
    },
    [conversation.id, dispatch],
  );

  // On the optimistic fast path the models listing may not be loaded yet;
  // render the description using the known default model reference instead of
  // blocking on a spinner.
  if (models.length === 0 && !isOptimisticDefaultModelLoad) {
    return (
      <div className="flex w-full items-center justify-center rounded-t p-4">
        <Spinner size={DEFAULT_ICON_SIZES.SMALL} className="mx-auto" />
      </div>
    );
  }

  const isReplayAsIs = isReplayAsIsConversation(conversation);
  const isPlayback = isPlaybackConversation(conversation);
  const isEmptyChatChangeAgentHidden =
    enabledFeatures.has(Feature.HideEmptyChatChangeAgent) ||
    isApplicationPreviewChat;
  const isEmptyChatSettingsEnabled = enabledFeatures.has(
    Feature.EmptyChatSettings,
  );
  const incorrectModel = !model;
  const isReadOnly = isEntityReadOnly(conversation);
  const isExternal = isEntityIdExternal(conversation);
  const modelIconSize = screenState === ScreenState.SM ? 36 : 50;
  const isOldReplay = isOldConversationReplay(conversation.replay);
  const PseudoIcon = isPlayback
    ? PlaybackIcon
    : isReplayAsIs
      ? ReplayAsIsIcon
      : null;

  return (
    <div className="flex size-full flex-col items-center gap-5 rounded-t px-3 py-4 md:px-0 lg:max-w-3xl">
      <div
        className={classNames(
          'flex size-full justify-center whitespace-pre text-center',
          incorrectModel ? 'text-[40px]' : 'text-sm',
        )}
      >
        <div className="flex flex-col gap-3" data-qa="entity-info-container">
          <div
            className="flex flex-col items-center justify-center gap-5 text-3xl leading-10"
            data-qa="entity-info"
          >
            {PseudoIcon ? (
              <PseudoIcon size={modelIconSize} />
            ) : (
              <ModelIcon
                entity={model}
                entityId={model?.id ?? conversation.model.id}
                size={modelIconSize}
                isCustomTooltip
              />
            )}
            <div className="flex items-center gap-2 whitespace-pre-wrap">
              <span
                data-qa="entity-name"
                className={classNames(
                  'break-words',
                  incorrectModel &&
                    !isReplayAsIs &&
                    !isPlayback &&
                    'text-secondary',
                )}
              >
                {getModelName(conversation, model)}
              </span>
            </div>
          </div>
          {isReplayAsIs && (
            <>
              <span
                className="whitespace-pre-wrap text-secondary"
                data-qa="agent-descr"
              >
                <EntityMarkdownDescription
                  className="!text-base"
                  isShortDescription
                >
                  {t(ChatI18nKeys.ReplayAsIsDescription)}
                </EntityMarkdownDescription>
              </span>
              {isOldReplay && (
                <span className="text-error">
                  <EntityMarkdownDescription
                    className="!text-sm"
                    isShortDescription
                  >
                    {t(ChatI18nKeys.OldReplayWarning)}
                  </EntityMarkdownDescription>
                </span>
              )}
            </>
          )}
          {model && !(isPlayback || isReplayAsIs) && (
            <>
              <div className="flex items-center justify-center gap-2">
                <ModelVersionSelect
                  className="h-max w-fit self-center"
                  entities={isIsolatedView ? [model] : versions}
                  onSelect={handleSelectVersion}
                  currentEntity={model}
                  showVersionPrefix
                />
                {model && <FunctionStatusIndicator entity={model} />}
              </div>
              {!!getModelDescription(model) && (
                <span
                  className="whitespace-pre-wrap text-secondary"
                  data-qa="agent-descr"
                >
                  <EntityMarkdownDescription
                    className="!text-base"
                    isShortDescription
                  >
                    {getModelDescription(model)}
                  </EntityMarkdownDescription>
                </span>
              )}
            </>
          )}
        </div>
      </div>
      {(!isReadOnly || !isExternal) && (
        <div className="flex gap-3 divide-x divide-primary leading-4 rtl:divide-x-reverse">
          {!isEmptyChatChangeAgentHidden && (
            <DialLinkButton
              data-qa="change-agent"
              onClick={handleOpenChangeModel}
              label={t(ChatI18nKeys.ChangeAgent)}
              className="px-0"
            />
          )}
          {!isReplayAsIs && !isPlayback && isEmptyChatSettingsEnabled && (
            <DialLinkButton
              data-qa="configure-settings"
              onClick={handleOpenSettings}
              label={t(ChatI18nKeys.ConfigureSettings)}
              className="rounded-none border-y-0 px-3"
            />
          )}
        </div>
      )}
    </div>
  );
};

interface Props {
  conversation: Conversation;
  onShowChangeModel: (conversationId: string) => void;
  onShowSettings: (show: boolean) => void;
  isApplicationPreviewChat: boolean;
}

export const EmptyChatDescription = ({
  conversation,
  onShowChangeModel,
  onShowSettings,
  isApplicationPreviewChat,
}: Props) => {
  return (
    <div className="flex size-full flex-col items-center p-0 md:px-5">
      <div className="flex size-full flex-col items-center gap-px rounded">
        <EmptyChatDescriptionView
          isApplicationPreviewChat={isApplicationPreviewChat}
          conversation={conversation}
          onShowChangeModel={onShowChangeModel}
          onShowSettings={onShowSettings}
        />
      </div>
    </div>
  );
};

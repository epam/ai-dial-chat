import { useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getModelDescription } from '@/src/utils/app/application';
import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { Conversation } from '@/src/types/chat';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { Spinner } from '../Common/Spinner';
import { FunctionStatusIndicator } from '../Marketplace/FunctionStatusIndicator';
import { ModelVersionSelect } from './ModelVersionSelect';

interface Props {
  conversation: Conversation;
  modelsLoaded: boolean;
  setShowChangeModel: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
}

export const EmptyChatDescription = ({
  conversation,
  modelsLoaded,
  // setShowChangeModel,
  setShowSettings,
}: Props) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.Chat);
  const model = useAppSelector((state) =>
    ModelsSelectors.selectModel(state, conversation.model.id),
  );
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const models = useAppSelector(ModelsSelectors.selectModels);
  const isIsolatedView = useAppSelector(SettingsSelectors.selectIsIsolatedView);

  const versions = useMemo(
    () =>
      models.filter(
        (m) => installedModelIds.has(m.reference) && m.name === model?.name,
      ),
    [installedModelIds, model?.name, models],
  );
  const incorrectModel = !model;
  // TODO: uncomment in https://github.com/epam/ai-dial-chat/issues/2047
  // const handleOpenChangeModel = useCallback(
  //   () => setShowChangeModel(true),
  //   [setShowChangeModel],
  // );
  const handleOpenSettings = useCallback(
    () => setShowSettings(true),
    [setShowSettings],
  );

  const handleSelectVersion = useCallback(
    (model: DialAIEntityModel) => {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversation.id,
          values: { model: { id: model.id } },
        }),
      );
    },
    [conversation.id, dispatch],
  );

  return (
    <div className="flex size-full flex-col items-center p-0 md:px-5 md:pt-5">
      <div className="flex size-full flex-col items-center gap-px rounded">
        {!modelsLoaded ? (
          <div className="flex w-full items-center justify-center rounded-t p-4">
            <Spinner size={16} className="mx-auto" />
          </div>
        ) : (
          <div className="flex size-full flex-col items-center gap-5 rounded-t py-4 lg:max-w-3xl">
            <div
              data-qa="app-name"
              className={classNames(
                'flex size-full justify-center whitespace-pre text-center',
                incorrectModel ? 'text-[40px]' : 'text-sm',
              )}
            >
              {/* {incorrectModel ? (
                <ModelIcon
                      entity={model}
                      entityId={model.id}
                      size={48}
                      isCustomTooltip
                    />
                <div className="text-secondary">{conversation.model.id}</div>
              ) : ( */}
              <div
                className="flex flex-col gap-3"
                data-qa="agent-info-container"
              >
                <div
                  className="flex flex-col items-center justify-center gap-5 text-3xl leading-10"
                  data-qa="agent-info"
                >
                  <ModelIcon
                    entity={model}
                    entityId={model?.id ?? conversation.model.id}
                    size={48}
                    isCustomTooltip
                  />
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span
                      data-qa="agent-name"
                      className={classNames(incorrectModel && 'text-secondary')}
                    >
                      {model
                        ? getOpenAIEntityFullName(model)
                        : conversation.model.id}
                    </span>
                    {model && <FunctionStatusIndicator entity={model} />}
                  </div>
                </div>
                {model && (
                  <>
                    <ModelVersionSelect
                      className="h-max w-fit self-center"
                      entities={versions}
                      onSelect={handleSelectVersion}
                      currentEntity={model}
                      showVersionPrefix
                    />
                    {!!getModelDescription(model) && (
                      <span
                        className="whitespace-pre-wrap text-xs text-secondary"
                        data-qa="agent-descr"
                      >
                        <EntityMarkdownDescription isShortDescription>
                          {getModelDescription(model)}
                        </EntityMarkdownDescription>
                      </span>
                    )}
                  </>
                )}
              </div>
              {/* )} */}
            </div>
            {!isIsolatedView && (
              <div className="flex gap-3 divide-x divide-primary leading-4">
                {/* <button
                className={classNames(
                  'text-left text-accent-primary disabled:cursor-not-allowed',
                )}
                data-qa="change-model"
                onClick={handleOpenChangeModel}
              >
                {t('Change agent')}
              </button> */}
                <button
                  className={classNames(
                    'text-left text-accent-primary disabled:cursor-not-allowed', // TODO: add `pl-3`
                  )}
                  data-qa="configure-settings"
                  onClick={handleOpenSettings}
                >
                  {t('Configure settings')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

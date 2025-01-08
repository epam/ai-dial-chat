import { IconSearch } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';

import { useTranslation } from 'next-i18next';
import Link from 'next/link';

import classNames from 'classnames';

import { getApplicationType } from '@/src/utils/app/application';
import {
  getConversationModelParams,
  groupModelsAndSaveOrder,
} from '@/src/utils/app/conversation';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';
import { ApiUtils, PseudoModel } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import { ApplicationActions } from '@/src/store/application/application.reducers';
import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { MarketplaceQueryParams } from '@/src/constants/marketplace';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { ApplicationWizard } from '@/src/components/Common/ApplicationWizard/ApplicationWizard';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import Modal from '@/src/components/Common/Modal';

import { ApplicationLogs } from '../../Marketplace/ApplicationLogs';
import { TalkToSlider } from './TalkToSlider';

import { Feature, PublishActions, ShareEntity } from '@epam/ai-dial-shared';
import orderBy from 'lodash-es/orderBy';

interface TalkToModalViewProps {
  conversation: Conversation;
  isCompareMode: boolean;
  isRight: boolean;
  onClose: () => void;
}

const TalkToModalView = ({
  conversation,
  isCompareMode,
  isRight,
  onClose,
}: TalkToModalViewProps) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useDispatch();

  const isMarketplaceEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Marketplace),
  );
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);
  const installedModelIdsSet = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const recentModelIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);

  const [searchTerm, setSearchTerm] = useState('');
  const [editModel, setEditModel] = useState<DialAIEntityModel>();
  const [deleteModel, setDeleteModel] = useState<DialAIEntityModel>();
  const [logModel, setLogModel] = useState<DialAIEntityModel>();
  const [publishModel, setPublishModel] = useState<
    ShareEntity & { iconUrl?: string }
  >();
  const [sharedConversationNewModel, setSharedConversationNewModel] =
    useState<DialAIEntityModel>();

  const isPlayback = conversation.playback?.isPlayback;
  const isReplay = conversation.replay?.isReplay;

  const displayedModels = useMemo(() => {
    const currentModel = modelsMap[conversation.model.id];
    const recentInstalledModels = recentModelIds
      .filter(
        (recentModelId) =>
          installedModelIdsSet.has(recentModelId) && modelsMap[recentModelId],
      )
      .map((recentModelId) => {
        return modelsMap[recentModelId] as DialAIEntityModel;
      })
      .filter(Boolean);
    const installedModels = allModels.filter(
      (model) =>
        installedModelIdsSet.has(model.reference) && modelsMap[model.reference],
    );

    const sortedModels = [
      ...(currentModel ? [currentModel] : []),
      ...recentInstalledModels,
      ...installedModels,
    ];

    const filteredModels = sortedModels.filter(
      (entity) =>
        doesEntityContainSearchTerm(entity, searchTerm) ||
        (entity.version &&
          doesEntityContainSearchTerm({ name: entity.version }, searchTerm)),
    );
    const groupedModels = groupModelsAndSaveOrder(filteredModels);
    const orderedModels = groupedModels.map(({ entities }) => {
      const selectedEntity = entities.find(
        ({ id }) => id === conversation.model.id,
      );

      if (selectedEntity) {
        return selectedEntity;
      }

      return orderBy(entities, 'version', 'desc')[0];
    });

    if (isPlayback) {
      orderedModels.unshift({
        id: PseudoModel.Playback,
        name: t('Playback'),
        reference: PseudoModel.Playback,
        type: EntityType.Model,
        isDefault: false,
      });
    } else if (isReplay) {
      orderedModels.unshift({
        id: REPLAY_AS_IS_MODEL,
        name: t('Replay as is'),
        description:
          t(
            'This mode replicates user requests from the original conversation including settings set in each message.',
          ) ?? '',
        reference: REPLAY_AS_IS_MODEL,
        type: EntityType.Model,
        isDefault: false,
      });
    } else if (!modelsMap[conversation.model.id]) {
      orderedModels.unshift({
        id: conversation.model.id,
        name: conversation.model.id,
        reference: conversation.model.id,
        description:
          t('chat.error.incorrect-selected', {
            context: EntityType.Model,
          }) ?? '',
        type: EntityType.Model,
        isDefault: false,
      });
    }

    return orderedModels;
  }, [
    allModels,
    conversation.model.id,
    installedModelIdsSet,
    isPlayback,
    isReplay,
    modelsMap,
    recentModelIds,
    searchTerm,
    t,
  ]);

  const handleUpdateConversationModel = useCallback(
    (entity: DialAIEntityModel) => {
      const model = modelsMap[entity.reference];

      if (
        (model || entity.reference === REPLAY_AS_IS_MODEL) &&
        (conversation.model.id !== entity.reference ||
          conversation.replay?.replayAsIs)
      ) {
        dispatch(
          ConversationsActions.updateConversation({
            id: conversation.id,
            values: {
              ...getConversationModelParams(
                conversation,
                entity.reference,
                modelsMap,
                addonsMap,
              ),
            },
          }),
        );
      }

      onClose();
    },
    [addonsMap, conversation, dispatch, modelsMap, onClose],
  );

  const handleCloseApplicationLogs = useCallback(
    () => setLogModel(undefined),
    [],
  );

  const handleOpenApplicationLogs = useCallback((entity: DialAIEntityModel) => {
    setLogModel(entity);
  }, []);

  const handleSelectModel = useCallback(
    (entity: DialAIEntityModel) => {
      if (conversation.isShared && entity.reference !== conversation.model.id) {
        setSharedConversationNewModel(entity);
        return;
      }

      handleUpdateConversationModel(entity);
    },
    [
      conversation.isShared,
      conversation.model.id,
      handleUpdateConversationModel,
    ],
  );

  const handleEditApplication = useCallback(
    (entity: DialAIEntityModel) => {
      dispatch(ApplicationActions.get(entity.id));
      setEditModel(entity);
    },
    [dispatch],
  );

  const handleCloseEditDialog = useCallback(
    () => setEditModel(undefined),
    [setEditModel],
  );

  const handleDeleteClose = useCallback(
    (confirm: boolean) => {
      if (confirm && deleteModel) {
        dispatch(ApplicationActions.delete(deleteModel));
      }

      setDeleteModel(undefined);
    },
    [deleteModel, dispatch],
  );

  const handleSetPublishEntity = useCallback((entity: DialAIEntityModel) => {
    setPublishModel({
      name: entity.name,
      id: ApiUtils.decodeApiUrl(entity.id),
      folderId: getFolderIdFromEntityId(entity.id),
      iconUrl: entity.iconUrl,
    });
  }, []);

  const handlePublishClose = useCallback(() => setPublishModel(undefined), []);

  const handleDeleteApplication = useCallback(
    (entity: DialAIEntityModel) => {
      setDeleteModel(entity);
    },
    [setDeleteModel],
  );

  return (
    <>
      <h3 className="text-base font-semibold">
        {t(
          `Select an agent for ${isCompareMode ? (isRight ? 'right side' : 'left side') : ''} conversation`,
        )}
      </h3>
      <div className="relative my-4 w-full">
        <IconSearch
          className="absolute left-3 top-1/2 -translate-y-1/2"
          size={18}
        />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('Search') ?? ''}
          className="input-form peer m-0 pl-[38px]"
          data-qa="search-agents"
        />
      </div>

      <TalkToSlider
        conversation={conversation}
        items={displayedModels}
        onEdit={handleEditApplication}
        onDelete={handleDeleteApplication}
        onPublish={handleSetPublishEntity}
        onSelectModel={handleSelectModel}
        onOpenLogs={handleOpenApplicationLogs}
      />

      {isMarketplaceEnabled && (
        <Link
          href={`/marketplace?${MarketplaceQueryParams.fromConversation}=${ApiUtils.encodeApiUrl(conversation.id)}`}
          shallow
          onClick={(e) =>
            conversation.playback?.isPlayback
              ? e.preventDefault()
              : dispatch(ConversationsActions.setTalkToConversationId(null))
          }
          className={classNames(
            'm-auto mt-4 text-accent-primary md:absolute md:bottom-6 md:right-6',
            conversation.playback?.isPlayback && 'cursor-not-allowed',
          )}
          data-qa="go-to-my-workspace"
        >
          {t('Go to My workspace')}
        </Link>
      )}

      {editModel && (
        <ApplicationWizard
          isOpen
          onClose={handleCloseEditDialog}
          isEdit
          currentReference={editModel.reference}
          type={getApplicationType(editModel)}
        />
      )}
      {deleteModel && (
        <ConfirmDialog
          isOpen
          heading={t('Confirm deleting application')}
          description={
            t(
              'Are you sure you want to delete the {{modelName}}{{modelVersion}}?',
              {
                modelName: deleteModel.name,
                modelVersion: deleteModel.version
                  ? t(' (version {{version}})', {
                      version: deleteModel.version,
                    })
                  : '',
              },
            ) ?? ''
          }
          confirmLabel={t('Delete')}
          onClose={handleDeleteClose}
          cancelLabel={t('Cancel')}
        />
      )}
      {publishModel && (
        <PublishModal
          entity={publishModel}
          type={SharingType.Application}
          isOpen
          onClose={handlePublishClose}
          publishAction={PublishActions.ADD}
        />
      )}
      {logModel && (
        <ApplicationLogs
          isOpen
          onClose={handleCloseApplicationLogs}
          entityId={logModel.id}
        />
      )}
      {sharedConversationNewModel && (
        <ConfirmDialog
          isOpen
          heading={t('Confirm model changing')}
          confirmLabel={t('Confirm')}
          cancelLabel={t('Cancel')}
          description={
            t(
              'Model changing will stop sharing and other users will no longer see this conversation.',
            ) || ''
          }
          onClose={(result) => {
            if (result && sharedConversationNewModel) {
              handleUpdateConversationModel(sharedConversationNewModel);
            }

            setSharedConversationNewModel(undefined);
          }}
        />
      )}
    </>
  );
};

interface Props {
  conversation: Conversation;
  isCompareMode: boolean;
  isRight: boolean;
  onClose: () => void;
}

export const TalkToModal = ({
  conversation,
  isCompareMode,
  isRight,
  onClose,
}: Props) => {
  return (
    <Modal
      portalId="theme-main"
      state={ModalState.OPENED}
      dataQa="talk-to-agent"
      containerClassName="flex xl:h-fit relative max-h-full flex-col rounded py-4 px-3 md:p-6 w-full grow items-start justify-center !bg-layer-2 md:w-[728px] md:max-w-[728px] xl:w-[1200px] xl:max-w-[1200px]"
      onClose={onClose}
    >
      <TalkToModalView
        isCompareMode={isCompareMode}
        isRight={isRight}
        conversation={conversation}
        onClose={onClose}
      />
    </Modal>
  );
};

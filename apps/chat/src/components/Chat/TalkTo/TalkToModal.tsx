import {
  IconCaretLeftFilled,
  IconCaretRightFilled,
  IconSearch,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useSwipe } from '@/src/hooks/useSwipe';

import { getApplicationType } from '@/src/utils/app/application';
import {
  getConversationModelParams,
  groupModelsAndSaveOrder,
} from '@/src/utils/app/conversation';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';
import { ApiUtils, PseudoModel, isPseudoModel } from '@/src/utils/server/api';

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

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { MarketplaceQueryParams } from '@/src/constants/marketplace';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { ApplicationWizard } from '@/src/components/Common/ApplicationWizard/ApplicationWizard';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import Modal from '@/src/components/Common/Modal';
import { NoResultsFound } from '@/src/components/Common/NoResultsFound';

import { TalkToCard } from './TalkToCard';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';
import chunk from 'lodash-es/chunk';
import orderBy from 'lodash-es/orderBy';
import range from 'lodash-es/range';

interface SliderModelsGroupProps {
  modelsGroup: DialAIEntityModel[];
  conversation: Conversation;
  allModelsRefsSet: Set<string>;
  onEditApplication: (entity: DialAIEntityModel) => void;
  onDeleteApplication: (entity: DialAIEntityModel) => void;
  onSetPublishEntity: (entity: DialAIEntityModel) => void;
  onSelectModel: (entity: DialAIEntityModel) => void;
}
const SliderModelsGroup = ({
  modelsGroup,
  conversation,
  allModelsRefsSet,
  onEditApplication,
  onDeleteApplication,
  onSetPublishEntity,
  onSelectModel,
}: SliderModelsGroupProps) => {
  return (
    <section
      key={modelsGroup.map((model) => model.id).join('.')}
      className="h-full min-w-full"
    >
      <ul className="grid grid-cols-3 grid-rows-3 gap-4" data-qa="applications">
        {modelsGroup.map((model) => {
          const isNotPseudoModelSelected =
            model.reference === conversation.model.id &&
            !conversation.playback?.isPlayback &&
            !conversation.replay?.replayAsIs;
          const isPseudoModelSelected =
            model.reference === PseudoModel.Playback ||
            (model.reference === REPLAY_AS_IS_MODEL &&
              !!conversation.replay?.replayAsIs);

          return (
            <TalkToCard
              onEdit={onEditApplication}
              onDelete={onDeleteApplication}
              onPublish={onSetPublishEntity}
              onSelectVersion={onSelectModel}
              isSelected={isNotPseudoModelSelected || isPseudoModelSelected}
              isUnavailableModel={
                !allModelsRefsSet.has(model.reference) &&
                !isPseudoModel(model.id) &&
                model.reference !== REPLAY_AS_IS_MODEL
              }
              disabled={
                !!conversation.playback?.isPlayback &&
                model.reference !== PseudoModel.Playback
              }
              key={model.id}
              entity={model}
              onClick={onSelectModel}
            />
          );
        })}
      </ul>
    </section>
  );
};

interface Props {
  conversation: Conversation;
  onClose: () => void;
}

const GRID_GAP = 16;

const calculateTranslateX = (activeSlide: number, clientWidth?: number) => {
  if (!clientWidth) return 'none';

  const offset = activeSlide * (clientWidth + GRID_GAP);

  return `translateX(-${offset}px)`;
};

export const TalkToModal = ({ conversation, onClose }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const router = useRouter();

  const dispatch = useDispatch();

  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);
  const installedModelIdsSet = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const recentModelIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [editModel, setEditModel] = useState<DialAIEntityModel>();
  const [deleteModel, setDeleteModel] = useState<DialAIEntityModel>();
  const [publishModel, setPublishModel] = useState<
    ShareEntity & { iconUrl?: string }
  >();

  const sliderRef = useRef<HTMLDivElement>(null);

  const allModelsRefsSet = useMemo(
    () => new Set(allModels.map((model) => model.reference)),
    [allModels],
  );

  const isPlayback = conversation.playback?.isPlayback;
  const isReplay = conversation.replay?.isReplay;

  const sliderGroups = useMemo(() => {
    const currentModel = modelsMap[conversation.model.id];
    const recentInstalledModels = recentModelIds
      .filter(
        (recentModelId) =>
          installedModelIdsSet.has(recentModelId) &&
          allModelsRefsSet.has(recentModelId),
      )
      .map((recentModelId) => {
        return modelsMap[recentModelId] as DialAIEntityModel;
      })
      .filter(Boolean);
    const installedModels = allModels.filter(
      (model) =>
        installedModelIdsSet.has(model.reference) &&
        allModelsRefsSet.has(model.reference),
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
        reference: REPLAY_AS_IS_MODEL,
        type: EntityType.Model,
        isDefault: false,
      });
    } else if (!allModelsRefsSet.has(conversation.model.id)) {
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

    return chunk(orderedModels, 9);
  }, [
    allModels,
    allModelsRefsSet,
    conversation.model.id,
    installedModelIdsSet,
    isPlayback,
    isReplay,
    modelsMap,
    recentModelIds,
    searchTerm,
    t,
  ]);

  const swipeHandlers = useSwipe({
    onSwipedLeft: () => {
      setActiveSlide((slide) =>
        slide >= sliderGroups.length - 1 ? sliderGroups.length - 1 : slide + 1,
      );
    },
    onSwipedRight: () => {
      setActiveSlide((slide) => (slide === 0 ? 0 : slide - 1));
    },
  });

  useEffect(() => {
    if (activeSlide !== 0 && activeSlide > sliderGroups.length - 1) {
      setActiveSlide(sliderGroups.length - 1);
    }
  }, [activeSlide, sliderGroups]);

  const handleSelectModel = useCallback(
    (entity: DialAIEntityModel) => {
      const model = modelsMap[entity.reference];

      if (
        (!model && entity.reference !== REPLAY_AS_IS_MODEL) ||
        conversation.model.id === entity.reference
      ) {
        return;
      }

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

      onClose();
    },
    [addonsMap, conversation, dispatch, modelsMap, onClose],
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

  const sliderDotsArray = range(0, sliderGroups.length);

  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa="talk-to-modal"
      containerClassName="flex h-fit p-6 max-h-full flex-col rounded py-3 md:py-4 w-full grow items-start justify-center !bg-layer-2 max-w-[1200px] w-[1200px]"
      onClose={onClose}
    >
      <h3 className="text-base font-semibold">
        {t('Select an agent for conversation')}
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
          className="input-form peer pl-[38px]"
          data-qa="search-models"
        />
      </div>
      <div ref={sliderRef} className="w-full overflow-y-auto overflow-x-hidden">
        <div
          {...swipeHandlers}
          className="flex size-full h-[530px] gap-4 transition duration-1000 ease-out"
          style={{
            transform: calculateTranslateX(
              activeSlide,
              sliderRef.current?.clientWidth,
            ),
            gap: `${GRID_GAP}px`,
          }}
        >
          {sliderGroups.length ? (
            sliderGroups.map((modelsGroup) => (
              <SliderModelsGroup
                key={modelsGroup.map((model) => model.id).join('.')}
                modelsGroup={modelsGroup}
                conversation={conversation}
                allModelsRefsSet={allModelsRefsSet}
                onEditApplication={handleEditApplication}
                onDeleteApplication={handleDeleteApplication}
                onSetPublishEntity={handleSetPublishEntity}
                onSelectModel={handleSelectModel}
              />
            ))
          ) : (
            <div className="flex size-full items-center justify-center">
              <NoResultsFound />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex w-full items-center justify-end">
        <div className="flex w-1/2 justify-between">
          <div className="relative flex -translate-x-1/2 items-center gap-4">
            {sliderDotsArray.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setActiveSlide((activeSlide) =>
                      activeSlide === 0 ? activeSlide : activeSlide - 1,
                    )
                  }
                  disabled={activeSlide === 0}
                  className="text-secondary hover:text-accent-primary disabled:cursor-not-allowed disabled:hover:text-secondary"
                >
                  <IconCaretLeftFilled size={18} />
                </button>
                {sliderDotsArray.map((slideNumber) => (
                  <button
                    key={slideNumber}
                    onClick={() => setActiveSlide(slideNumber)}
                    className={classNames(
                      'size-2 rounded-full bg-controls-disable transition-all duration-200',
                      slideNumber === activeSlide ? 'h-2 w-8' : 'size-2',
                    )}
                  ></button>
                ))}
                <button
                  onClick={() =>
                    setActiveSlide((activeSlide) =>
                      activeSlide === sliderDotsArray.length - 1
                        ? activeSlide
                        : activeSlide + 1,
                    )
                  }
                  disabled={activeSlide === sliderDotsArray.length - 1}
                  className="text-secondary hover:text-accent-primary disabled:cursor-not-allowed disabled:hover:text-secondary"
                >
                  <IconCaretRightFilled size={18} />
                </button>
              </>
            )}
          </div>
          <button
            onClick={() =>
              router.push(
                `/marketplace?${MarketplaceQueryParams.fromConversation}=${ApiUtils.encodeApiUrl(conversation.id)}`,
              )
            }
            className="text-accent-primary"
          >
            {t('Go to My workspace')}
          </button>
        </div>
      </div>

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
          isOpen={!!publishModel}
          onClose={handlePublishClose}
          publishAction={PublishActions.ADD}
        />
      )}
    </Modal>
  );
};

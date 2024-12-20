import {
  IconCaretLeftFilled,
  IconCaretRightFilled,
  IconSearch,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';

import { useTranslation } from 'next-i18next';
import Link from 'next/link';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
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
import { EntityType, ScreenState } from '@/src/types/common';
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
import { NoResultsFound } from '@/src/components/Common/NoResultsFound';

import { TalkToCard } from './TalkToCard';

import { Feature, PublishActions, ShareEntity } from '@epam/ai-dial-shared';
import chunk from 'lodash-es/chunk';
import orderBy from 'lodash-es/orderBy';
import range from 'lodash-es/range';

const COMMON_GRID_TILES_GAP = 16;
const MOBILE_GRID_TILES_GAP = 12;
const getMaxChunksCountConfig = () => {
  return {
    [ScreenState.DESKTOP]: {
      cardHeight: 166,
      maxRows: 3,
      cols: 3,
    },
    [ScreenState.TABLET]: {
      cardHeight: 160,
      maxRows: 4,
      cols: 2,
    },
    [ScreenState.MOBILE]: {
      cardHeight: 98,
      maxRows: 5,
      cols: 1,
    },
  };
};
interface SliderModelsGroupProps {
  modelsGroup: DialAIEntityModel[];
  conversation: Conversation;
  screenState: ScreenState;
  rowsCount: number;
  onEditApplication: (entity: DialAIEntityModel) => void;
  onDeleteApplication: (entity: DialAIEntityModel) => void;
  onSetPublishEntity: (entity: DialAIEntityModel) => void;
  onSelectModel: (entity: DialAIEntityModel) => void;
}
const SliderModelsGroup = ({
  modelsGroup,
  conversation,
  screenState,
  rowsCount,
  onEditApplication,
  onDeleteApplication,
  onSetPublishEntity,
  onSelectModel,
}: SliderModelsGroupProps) => {
  const config = getMaxChunksCountConfig();

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  return (
    <section
      key={modelsGroup.map((model) => model.id).join('.')}
      className="h-full min-w-full"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${config[screenState].cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rowsCount}, ${config[screenState].cardHeight}px)`,
          gap:
            screenState === ScreenState.MOBILE
              ? MOBILE_GRID_TILES_GAP
              : COMMON_GRID_TILES_GAP,
        }}
        data-qa="agents"
      >
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
              isSelected={isNotPseudoModelSelected || isPseudoModelSelected}
              conversation={conversation}
              isUnavailableModel={
                !modelsMap[model.reference] &&
                !isPseudoModel(model.id) &&
                model.reference !== REPLAY_AS_IS_MODEL
              }
              disabled={
                !!conversation.playback?.isPlayback &&
                model.reference !== PseudoModel.Playback
              }
              key={model.id}
              entity={model}
              onEdit={onEditApplication}
              onDelete={onDeleteApplication}
              onPublish={onSetPublishEntity}
              onSelectVersion={onSelectModel}
              onClick={onSelectModel}
            />
          );
        })}
      </div>
    </section>
  );
};

interface TalkToModalViewProps {
  conversation: Conversation;
  isCompareMode: boolean;
  isRight: boolean;
  onClose: () => void;
}

const SLIDES_GAP = 16;
const calculateTranslateX = (activeSlide: number, clientWidth?: number) => {
  if (!clientWidth) return 'none';

  const offset = activeSlide * (clientWidth + SLIDES_GAP);

  return `translateX(-${offset}px)`;
};

const TalkToModalView = ({
  conversation,
  isCompareMode,
  isRight,
  onClose,
}: TalkToModalViewProps) => {
  const { t } = useTranslation(Translation.Chat);

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
  const [sliderHeight, setSliderHeight] = useState(0);
  const [sharedConversationNewModel, setSharedConversationNewModel] =
    useState<DialAIEntityModel>();

  const sliderRef = useRef<HTMLDivElement>(null);

  const screenState = useScreenState();

  const isPlayback = conversation.playback?.isPlayback;
  const isReplay = conversation.replay?.isReplay;
  const config = getMaxChunksCountConfig();
  const isMarketplaceEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Marketplace),
  );

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

  const sliderRowsCount = useMemo(() => {
    const availableRows =
      Math.floor(sliderHeight / config[screenState].cardHeight) || 1;

    const finalRows =
      availableRows === 1
        ? availableRows
        : Math.floor(
            (sliderHeight -
              (availableRows - 1) *
                (screenState === ScreenState.MOBILE
                  ? MOBILE_GRID_TILES_GAP
                  : COMMON_GRID_TILES_GAP)) /
              config[screenState].cardHeight,
          ) || 1;

    return finalRows > config[screenState].maxRows
      ? config[screenState].maxRows
      : finalRows;
  }, [config, screenState, sliderHeight]);

  const sliderGroups = useMemo(() => {
    return chunk(displayedModels, sliderRowsCount * config[screenState].cols);
  }, [config, displayedModels, screenState, sliderRowsCount]);

  const sliderDotsArray = range(0, sliderGroups.length);

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
    const handleResize = () => {
      if (sliderRef.current) {
        setSliderHeight(sliderRef.current.clientHeight);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);

    if (sliderRef.current) {
      resizeObserver.observe(sliderRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!sliderGroups.length) {
      setActiveSlide(0);
    } else if (activeSlide !== 0 && activeSlide > sliderGroups.length - 1) {
      setActiveSlide(sliderGroups.length - 1);
    }
  }, [activeSlide, sliderGroups]);

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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setActiveSlide((activeSlide) =>
          activeSlide === sliderDotsArray.length - 1
            ? activeSlide
            : activeSlide + 1,
        );
      } else if (e.key === 'ArrowLeft') {
        setActiveSlide((activeSlide) =>
          activeSlide === 0 ? activeSlide : activeSlide - 1,
        );
      }
    },
    [sliderDotsArray.length],
  );

  useEffect(() => {
    if (isPlayback) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown, isPlayback]);

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
      <div
        ref={sliderRef}
        className="flex h-[428px] max-h-[428px] w-full flex-col overflow-y-auto overflow-x-hidden md:h-[688px] md:max-h-[688px] xl:h-[530px] xl:max-h-[530px]"
      >
        <div
          {...swipeHandlers}
          className={classNames(
            'flex size-full',
            sliderGroups.length && 'transition duration-1000 ease-out',
          )}
          style={{
            transform: calculateTranslateX(
              activeSlide,
              sliderRef.current?.clientWidth,
            ),
            gap: `${SLIDES_GAP}px`,
          }}
        >
          {sliderGroups.length ? (
            sliderGroups.map((modelsGroup) => (
              <SliderModelsGroup
                key={modelsGroup.map((model) => model.id).join('.')}
                modelsGroup={modelsGroup}
                conversation={conversation}
                screenState={screenState}
                rowsCount={sliderRowsCount}
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
      <div className="mt-4 flex w-full items-center justify-center md:justify-end">
        <div className="flex flex-col items-center md:w-1/2 md:flex-row md:justify-between">
          <div className="relative flex items-center gap-4 md:-translate-x-1/2">
            {sliderDotsArray.length <= 1 &&
              screenState === ScreenState.MOBILE && (
                <span className="h-[18px] bg-transparent"></span>
              )}
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
          {isMarketplaceEnabled && (
            <Link
              href={`/marketplace?${MarketplaceQueryParams.fromConversation}=${ApiUtils.encodeApiUrl(conversation.id)}`}
              shallow
              onClick={(e) =>
                conversation.playback?.isPlayback ? e.preventDefault() : null
              }
              className={classNames(
                'mt-4 text-accent-primary md:mt-0',
                conversation.playback?.isPlayback && 'cursor-not-allowed',
              )}
              data-qa="go-to-my-workspace"
            >
              {t('Go to My workspace')}
            </Link>
          )}
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

      <ConfirmDialog
        isOpen={!!sharedConversationNewModel}
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
      containerClassName="flex xl:h-fit max-h-full flex-col rounded py-4 px-3 md:p-6 w-full grow items-start justify-center !bg-layer-2 md:w-[728px] md:max-w-[728px] xl:w-[1200px] xl:max-w-[1200px]"
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

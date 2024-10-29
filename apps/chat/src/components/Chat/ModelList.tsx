import {
  IconChevronDown,
  IconDots,
  IconPencilMinus,
  IconTrashX,
  IconWorldShare,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  getApplicationType,
  getModelDescription,
  isApplicationStatusUpdating,
} from '@/src/utils/app/application';
import {
  getOpenAIEntityFullName,
  groupModelsAndSaveOrder,
} from '@/src/utils/app/conversation';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { isApplicationId } from '@/src/utils/app/id';
import { hasParentWithAttribute } from '@/src/utils/app/modals';
import { isEntityPublic } from '@/src/utils/app/publications';
import { doesOpenAIEntityContainSearchTerm } from '@/src/utils/app/search';
import { ApiUtils } from '@/src/utils/server/api';

import { ApplicationType } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { DESCRIPTION_DELIMITER_REGEX } from '@/src/constants/chat';

import { ApplicationWizard } from '@/src/components/Common/ApplicationWizard/ApplicationWizard';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import ContextMenu from '../Common/ContextMenu';
import { DisableOverlay } from '../Common/DisableOverlay';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { ModelVersionSelect } from './ModelVersionSelect';
import { PublishModal } from './Publish/PublishWizard';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { Feature, PublishActions } from '@epam/ai-dial-shared';

interface ModelGroupProps {
  entities: DialAIEntityModel[];
  selectedModelId: string | undefined;
  onSelect: (id: string) => void;
  notAllowExpandDescription?: boolean;
  searchTerm?: string;
  disabled?: boolean;
  isReplayAsIs?: boolean;
  handleChangeCurrentEntity: (model: DialAIEntityModel) => void;
  handlePublish: (action: PublishActions) => void;
  handleOpenDeleteConfirmModal: () => void;
  handleEdit: (currentEntity: DialAIEntityModel) => void;
}

const ModelGroup = ({
  entities,
  selectedModelId,
  onSelect,
  notAllowExpandDescription,
  searchTerm,
  disabled,
  isReplayAsIs,
  handleChangeCurrentEntity,
  handlePublish,
  handleOpenDeleteConfirmModal,
  handleEdit,
}: ModelGroupProps) => {
  const { t } = useTranslation(Translation.Chat);

  const recentModelsIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);

  const [isOpened, setIsOpened] = useState(false);

  const currentEntity = useMemo(() => {
    // if only 1 model without group
    if (entities.length < 2) {
      return entities[0];
    }
    // searched
    const searched = searchTerm
      ? entities.find((e) => doesOpenAIEntityContainSearchTerm(e, searchTerm))
      : undefined;
    if (searched) {
      return searched;
    }
    // selected
    const selected = entities.find((e) => e.reference === selectedModelId);
    if (selected) {
      return selected;
    }
    // find latest used version
    const minIndex = Math.min(
      ...recentModelsIds
        .map((rid) => entities.findIndex((e) => e.id === rid))
        .filter((ind) => ind !== -1),
      Number.MAX_SAFE_INTEGER,
    );
    return entities[minIndex === Number.MAX_SAFE_INTEGER ? 0 : minIndex];
  }, [entities, recentModelsIds, searchTerm, selectedModelId]);

  const description = getModelDescription(currentEntity);
  const isPublicEntity = isEntityPublic(currentEntity);
  const isModifyDisabled = isApplicationStatusUpdating(currentEntity);

  const handleSelectVersion = useCallback(
    (entity: DialAIEntityModel) => onSelect(entity.id),
    [onSelect],
  );

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Edit'),
        dataQa: 'edit',
        display: !isPublicEntity,
        disabled: isModifyDisabled,
        Icon: IconPencilMinus,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handleChangeCurrentEntity(currentEntity);
          handleEdit(currentEntity);
        },
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display: !isPublicEntity,
        Icon: IconWorldShare,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handleChangeCurrentEntity(currentEntity);
          handlePublish(PublishActions.ADD);
        },
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display: isPublicEntity,
        Icon: UnpublishIcon,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handleChangeCurrentEntity(currentEntity);
          handlePublish(PublishActions.DELETE);
        },
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        disabled: isModifyDisabled && !isPublicEntity,
        display: !isPublicEntity,
        Icon: IconTrashX,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handleChangeCurrentEntity(currentEntity);
          handleOpenDeleteConfirmModal();
        },
      },
    ],
    [
      t,
      currentEntity,
      isPublicEntity,
      handleChangeCurrentEntity,
      handleEdit,
      handlePublish,
      handleOpenDeleteConfirmModal,
      isModifyDisabled,
    ],
  );

  const isCustomApplicationsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CustomApplications),
  );

  return (
    <div
      className={classNames(
        'relative rounded border hover:border-hover',
        !disabled &&
          !isReplayAsIs &&
          selectedModelId === currentEntity.reference
          ? 'border-accent-primary'
          : 'border-primary',
        isOpened ? 'md:col-span-2' : 'md:col-span-1',
        !disabled ? 'cursor-pointer' : 'cursor-not-allowed',
      )}
      onClick={(e) => {
        if (disabled) {
          return;
        }
        if (
          !hasParentWithAttribute(
            e.target as HTMLAnchorElement,
            'data-model-versions',
          )
        ) {
          onSelect(currentEntity.reference);
        }
      }}
      data-qa="talk-to-entity"
    >
      {disabled && <DisableOverlay />}
      <div className="flex h-full items-center gap-3 overflow-hidden px-3 py-2">
        <ModelIcon
          entityId={currentEntity.id}
          entity={currentEntity}
          size={24}
        />
        <div className="flex w-full overflow-hidden">
          <div className="flex w-full flex-wrap">
            <div className="flex w-full items-center gap-2">
              <span data-qa="talk-to-entity-name" className="w-full truncate">
                {getOpenAIEntityFullName(currentEntity)}
              </span>
              <div className="flex items-center gap-2">
                <ModelVersionSelect
                  className="h-max"
                  entities={entities}
                  onSelect={handleSelectVersion}
                  currentEntity={currentEntity}
                />
                {isCustomApplicationsEnabled &&
                  isApplicationId(currentEntity.id) && (
                    <ContextMenu
                      menuItems={menuItems}
                      TriggerIcon={IconDots}
                      triggerIconSize={18}
                      className="m-0 justify-self-end"
                      featureType={FeatureType.Chat}
                    />
                  )}
              </div>
            </div>
            {description && (
              <span
                className="text-secondary"
                onClick={(e) => {
                  if ((e.target as HTMLAnchorElement)?.tagName === 'A') {
                    e.stopPropagation();
                  }
                }}
                data-qa="talk-to-entity-descr"
              >
                <EntityMarkdownDescription isShortDescription={!isOpened}>
                  {description}
                </EntityMarkdownDescription>
              </span>
            )}
          </div>
        </div>
        {!notAllowExpandDescription &&
          description &&
          description.search(DESCRIPTION_DELIMITER_REGEX) !== -1 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpened((isOpened) => !isOpened);
              }}
              data-qa="expand-talk-to-entity"
            >
              <IconChevronDown
                size={18}
                className={classNames(
                  'transition-all',
                  isOpened && 'rotate-180',
                )}
              />
            </button>
          )}
      </div>
    </div>
  );
};

interface ModelListProps {
  entities: DialAIEntityModel[];
  heading?: string;
  selectedModelId: string | undefined;
  onSelect: (entityId: string) => void;
  notAllowExpandDescription?: boolean;
  displayCountLimit?: number;
  showInOneColumn?: boolean;
  allEntities: DialAIEntityModel[];
  searchTerm?: string;
  disabled?: boolean;
  isReplayAsIs?: boolean;
}

export const ModelList = ({
  entities,
  heading,
  selectedModelId,
  onSelect,
  notAllowExpandDescription,
  displayCountLimit,
  showInOneColumn,
  allEntities,
  searchTerm,
  disabled,
  isReplayAsIs,
}: ModelListProps) => {
  const dispatch = useAppDispatch();

  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );

  const [applicationModal, setApplicationModal] = useState<{
    type: ApplicationType;
  }>();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentEntity, setCurrentEntity] = useState<DialAIEntityModel>();
  const [publishAction, setPublishAction] = useState<PublishActions>();

  const entityForPublish = useMemo(() => {
    if (!currentEntity) {
      return undefined;
    }

    return {
      name: currentEntity.name,
      id: ApiUtils.decodeApiUrl(currentEntity.id),
      folderId: getFolderIdFromEntityId(currentEntity.id),
      iconUrl: currentEntity.iconUrl,
    };
  }, [currentEntity]);

  const handleOpenApplicationModal = useCallback((type: ApplicationType) => {
    setApplicationModal({ type });
  }, []);

  const handleEdit = useCallback(
    (currentEntity: DialAIEntityModel) => {
      dispatch(ApplicationActions.get(currentEntity.id));
      handleOpenApplicationModal(getApplicationType(currentEntity));
    },
    [dispatch, handleOpenApplicationModal],
  );

  const handleOpenDeleteConfirmModal = useCallback(() => {
    setIsDeleteModalOpen(true);
  }, []);

  const handlePublish = useCallback((action: PublishActions) => {
    setPublishAction(action);
  }, []);

  const handlePublishClose = useCallback(() => {
    setPublishAction(undefined);
  }, []);

  const handleDelete = useCallback(() => {
    if (currentEntity) {
      dispatch(ApplicationActions.delete(currentEntity));
    }
  }, [currentEntity, dispatch]);

  const handleConfirmDialogClose = useCallback(
    (result: boolean) => {
      setIsDeleteModalOpen(false);

      if (result) {
        handleDelete();
      }
    },
    [handleDelete],
  );

  const handleCloseApplicationDialog = useCallback(() => {
    setApplicationModal(undefined);
  }, []);

  const groupedModels = useMemo(() => {
    const nameSet = new Set(entities.map((m) => m.name));
    const otherVersions = allEntities.filter((m) => nameSet.has(m.name));

    return groupModelsAndSaveOrder(
      entities
        .concat(otherVersions)
        .filter(
          (entity) =>
            installedModelIds.has(entity.reference) ||
            selectedModelId === entity.reference,
        ),
    ).slice(0, displayCountLimit ?? Number.MAX_SAFE_INTEGER);
  }, [
    allEntities,
    displayCountLimit,
    entities,
    installedModelIds,
    selectedModelId,
  ]);

  return (
    <div className="flex flex-col gap-3 text-xs" data-qa="talk-to-group">
      {heading && <span className="text-secondary">{heading}</span>}
      <div
        className={classNames(
          'grid min-h-0 shrink grid-cols-1 gap-3 overflow-y-auto',
          !showInOneColumn && 'md:grid-cols-2',
        )}
      >
        {groupedModels.map((modelGroup) => (
          <ModelGroup
            key={modelGroup.groupName}
            entities={modelGroup.entities}
            selectedModelId={selectedModelId}
            onSelect={onSelect}
            notAllowExpandDescription={notAllowExpandDescription}
            disabled={disabled}
            searchTerm={searchTerm}
            isReplayAsIs={isReplayAsIs}
            handleEdit={handleEdit}
            handleOpenDeleteConfirmModal={handleOpenDeleteConfirmModal}
            handleChangeCurrentEntity={setCurrentEntity}
            handlePublish={handlePublish}
          />
        ))}
      </div>
      {isDeleteModalOpen && (
        <ConfirmDialog
          isOpen={isDeleteModalOpen}
          heading="Confirm deleting application"
          description="Are you sure you want to delete the application?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onClose={handleConfirmDialogClose}
        />
      )}
      {!!applicationModal && (
        <ApplicationWizard
          isOpen={!!applicationModal}
          onClose={handleCloseApplicationDialog}
          type={applicationModal.type}
          currentReference={currentEntity?.reference}
          isEdit
        />
      )}
      {publishAction && entityForPublish && entityForPublish.id && (
        <PublishModal
          entity={entityForPublish}
          type={SharingType.Application}
          isOpen={!!publishAction}
          onClose={handlePublishClose}
          publishAction={publishAction}
        />
      )}
    </div>
  );
};

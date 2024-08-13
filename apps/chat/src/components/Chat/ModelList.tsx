import {
  IconChevronDown,
  IconDots,
  IconPencilMinus,
  IconTrashX,
  IconWorldShare,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  getOpenAIEntityFullName,
  groupModelsAndSaveOrder,
} from '@/src/utils/app/conversation';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { isApplicationId } from '@/src/utils/app/id';
import { hasParentWithAttribute } from '@/src/utils/app/modals';
import { doesOpenAIEntityContainSearchTerm } from '@/src/utils/app/search';
import { ApiUtils } from '@/src/utils/server/api';

import { FeatureType, ShareEntity } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import { PublishActions } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { ApplicationDialog } from '../Common/ApplicationDialog';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import ContextMenu from '../Common/ContextMenu';
import { DisableOverlay } from '../Common/DisableOverlay';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { ModelVersionSelect } from './ModelVersionSelect';
import { PublishModal } from './Publish/PublishWizard';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { Feature } from '@epam/ai-dial-shared';

interface ModelGroupProps {
  entities: DialAIEntityModel[];
  selectedModelId: string | undefined;
  onSelect: (id: string) => void;
  notAllowExpandDescription?: boolean;
  searchTerm?: string;
  disabled?: boolean;
  isReplayAsIs?: boolean;
  setIsDeleteModalOpen: (open: boolean) => void;
  setCurrentEntityName: (name: string) => void;
  setCurrentEntityId: (name: string) => void;
  setCurrentEntityReference: (reference: string) => void;
  openApplicationModal?: () => void;
  handlePublish: () => void;
}

const ModelGroup = ({
  entities,
  selectedModelId,
  onSelect,
  notAllowExpandDescription,
  searchTerm,
  disabled,
  isReplayAsIs,
  setIsDeleteModalOpen,
  openApplicationModal,
  setCurrentEntityName,
  setCurrentEntityId,
  setCurrentEntityReference,
  handlePublish,
}: ModelGroupProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.Chat);

  const [isOpened, setIsOpened] = useState(false);
  const recentModelsIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);
  const publishedApplicationIds = useAppSelector(
    ModelsSelectors.selectPublishedApplicationIds,
  );

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
    const selected = entities.find((e) => e.id === selectedModelId);
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

  const description = currentEntity.description;
  const applicationId = currentEntity.id;
  const isPublishedEntity = publishedApplicationIds.some(
    (id) => id === applicationId,
  );

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Edit'),
        dataQa: 'edit',
        display: !isPublishedEntity,
        Icon: IconPencilMinus,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          dispatch(ApplicationActions.get(applicationId));
          openApplicationModal && openApplicationModal();
          setCurrentEntityReference(currentEntity?.reference || '');
        },
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display: !isPublishedEntity,
        Icon: IconWorldShare,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          setCurrentEntityId(currentEntity.id);
          setCurrentEntityName(currentEntity.name);
          handlePublish();
        },
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display: isPublishedEntity,
        Icon: UnpublishIcon,
        // onClick: () => console.log('unpublish'),
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display: !isPublishedEntity,
        Icon: IconTrashX,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          setCurrentEntityId(currentEntity.id);
          setCurrentEntityName(currentEntity.name);
          setIsDeleteModalOpen(true);
        },
      },
    ],
    [
      openApplicationModal,
      dispatch,
      applicationId,
      currentEntity,
      isPublishedEntity,
    ],
  );

  const isCustomApplicationsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CustomApplications),
  );

  return (
    <div
      className={classNames(
        'relative rounded border hover:border-hover',
        !disabled && !isReplayAsIs && selectedModelId === currentEntity.id
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
          onSelect(currentEntity.id);
        }
      }}
      data-qa="group-entity"
    >
      {disabled && <DisableOverlay />}
      <div className="flex h-full items-center gap-3 overflow-hidden px-3 py-2">
        <ModelIcon
          entityId={currentEntity.id}
          entity={currentEntity}
          size={24}
        />
        <div className="flex w-full flex-col gap-1 text-left">
          <div className="flex items-center justify-between">
            <span data-qa="group-entity-name" className="whitespace-pre">
              {entities.length === 1
                ? getOpenAIEntityFullName(currentEntity)
                : currentEntity.name}
            </span>
            <div className="flex items-center gap-2">
              <ModelVersionSelect
                className="h-max"
                entities={entities}
                onSelect={onSelect}
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
                    onOpenChange={() => openApplicationModal}
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
              data-qa="group-entity-descr"
            >
              <EntityMarkdownDescription isShortDescription={!isOpened}>
                {description}
              </EntityMarkdownDescription>
            </span>
          )}
        </div>
        {!notAllowExpandDescription &&
          description &&
          description.indexOf('\n\n') !== -1 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpened((isOpened) => !isOpened);
              }}
              data-qa="expand-group-entity"
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

  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [currentEntityName, setCurrentEntityName] = useState('');
  const [currentEntityId, setCurrentEntityId] = useState('');
  const [currentEntityReference, setCurrentEntityReference] = useState('');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const recentModelsIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);
  const applicationDetail = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const [entity, setEntity] = useState<ShareEntity | null>(null);

  useEffect(() => {
    if (currentEntityName && currentEntityId) {
      setEntity({
        name: currentEntityName,
        id: ApiUtils.decodeApiUrl(
          currentEntityId ||
            (currentEntityName as unknown as { application: string })
              .application,
        ),
        folderId: getFolderIdFromEntityId(currentEntityName),
      });
    }
  }, [currentEntityName, currentEntityId]);

  const handlePublish = () => {
    setIsPublishing(true);
  };

  const handlePublishClose = () => {
    setIsPublishing(false);
  };

  const handleDelete = () => {
    if (currentEntityName && currentEntityId) {
      dispatch(
        ApplicationActions.delete({ currentEntityName, currentEntityId }),
      );
    }
    onSelect(recentModelsIds[0]);
  };

  const groupedModels = useMemo(() => {
    const nameSet = new Set(entities.map((m) => m.name));
    const otherVersions = allEntities.filter((m) => nameSet.has(m.name));
    return groupModelsAndSaveOrder(entities.concat(otherVersions)).slice(
      0,
      displayCountLimit ?? Number.MAX_SAFE_INTEGER,
    );
  }, [allEntities, displayCountLimit, entities]);

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
            openApplicationModal={() => setModalIsOpen(true)}
            setIsDeleteModalOpen={setIsDeleteModalOpen}
            setCurrentEntityName={setCurrentEntityName}
            setCurrentEntityId={setCurrentEntityId}
            setCurrentEntityReference={setCurrentEntityReference}
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
          onClose={(result) => {
            setIsDeleteModalOpen(false);
            if (result) {
              handleDelete();
            }
          }}
        />
      )}
      {modalIsOpen && applicationDetail && (
        <ApplicationDialog
          isOpen={modalIsOpen}
          onClose={() => setModalIsOpen(false)}
          selectedApplication={applicationDetail}
          currentReference={currentEntityReference}
          isEdit
        />
      )}
      {currentEntityName && currentEntityId && entity && (
        <PublishModal
          entity={entity}
          type={SharingType.Application}
          isOpen={isPublishing}
          onClose={handlePublishClose}
          publishAction={
            PublishActions.ADD
            // isPublishing ? PublishActions.ADD : PublishActions.DELETE
          }
        />
      )}
    </div>
  );
};

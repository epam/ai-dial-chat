import {
  IconCopy,
  IconEdit,
  IconFileArrowRight,
  IconFolderShare,
  IconInfoCircle,
  IconTrashX,
  IconUserShare,
  IconUserX,
  IconWorldShare,
  TablerIconsProps,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { getNextDefaultName } from '@/src/utils/app/folders';
import {
  getIdWithoutRootPathSegments,
  getPromptRootId,
  isMyEntity,
} from '@/src/utils/app/id';
import { regeneratePromptId } from '@/src/utils/app/prompts';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { defaultMyItemsFilters } from '@/src/utils/app/search';
import { constructPath, isRootId } from '@/src/utils/app/shared-utils';

import { FeatureType } from '@/src/types/common';
import { MoveToFolderProps } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { ChatActions } from '@/src/store/chat/chat.reducer';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';
import { PINNED_PROMPTS_SECTION_NAME } from '@/src/constants/sections';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { MoveToFolderModal } from '@/src/components/Common/MoveToFolderModal';
import Tooltip from '@/src/components/Common/Tooltip';

import { ConfirmDialog } from '../../Common/ConfirmDialog';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { PublishActions } from '@epam/ai-dial-shared';

interface PromptIconBtnProps {
  tooltip: string;
  dataQa: string;
  Icon: (props: TablerIconsProps) => JSX.Element;
  onClick: () => void;
}

const PromptIconBtn: React.FC<PromptIconBtnProps> = ({
  tooltip,
  dataQa,
  Icon,
  onClick,
}) => {
  const { t } = useTranslation(Translation.PromptBar);

  return (
    <Tooltip placement="top" isTriggerClickable tooltip={t(tooltip)}>
      <button
        onClick={onClick}
        className="flex cursor-pointer items-center justify-center rounded p-[5px] text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
        data-qa={dataQa}
      >
        <Icon className="size-6" strokeWidth="1.5" />
      </button>
    </Tooltip>
  );
};

interface Props {
  prompt: Prompt;
  onEditMode: () => void;
}

export const ViewPromptButtons: React.FC<Props> = ({ prompt, onEditMode }) => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const [isShowMoveToModal, setIsShowMoveToModal] = useState(false);
  const [publishPromptAction, setPublishPromptAction] =
    useState<PublishActions>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnshareConfirmOpened, setIsUnshareConfirmOpened] = useState(false);

  const filteredFoldersSelector = useMemo(
    () =>
      PromptsSelectors.selectFilteredFolders(defaultMyItemsFilters, '', true),
    [],
  );
  const collapsedSectionsSelector = useMemo(
    () => UISelectors.selectCollapsedSections(FeatureType.Prompt),
    [],
  );

  const folders = useAppSelector(filteredFoldersSelector);
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);
  const collapsedSections = useAppSelector(collapsedSectionsSelector);
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, FeatureType.Prompt),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, FeatureType.Prompt),
  );

  const handleClosePublishModal = useCallback(() => {
    setPublishPromptAction(undefined);
  }, []);

  const handleMoveToFolder = useCallback(
    ({ folderId, isNewFolder }: MoveToFolderProps) => {
      const promptRootId = getPromptRootId();
      const folderPath = (
        isNewFolder
          ? getNextDefaultName(
              t(DEFAULT_FOLDER_NAME),
              folders.filter((f) => f.folderId === promptRootId),
            )
          : folderId
      ) as string;

      if (
        !isEntityNameOnSameLevelUnique(
          prompt.name,
          { ...prompt, folderId: folderPath },
          allPrompts,
        )
      ) {
        dispatch(
          UIActions.showErrorToast(
            t('Prompt with name "{{name}}" already exists in this folder.', {
              ns: Translation.PromptBar,
              name: prompt.name,
            }),
          ),
        );

        return;
      }

      if (isNewFolder) {
        dispatch(
          PromptsActions.createFolder({
            name: folderPath,
            parentId: getPromptRootId(),
          }),
        );
      }

      dispatch(
        UIActions.setCollapsedSections({
          featureType: FeatureType.Prompt,
          collapsedSections: collapsedSections.filter(
            (section) => section !== PINNED_PROMPTS_SECTION_NAME,
          ),
        }),
      );
      const newFolderId = isNewFolder
        ? constructPath(getPromptRootId(), folderPath)
        : folderPath;

      dispatch(
        PromptsActions.updatePrompt({
          id: prompt.id,
          values: {
            folderId: newFolderId,
          },
        }),
      );
      dispatch(
        PromptsActions.setSelectedPrompt({
          promptId: regeneratePromptId({ ...prompt, folderId: newFolderId }).id,
        }),
      );
      dispatch(PromptsActions.uploadPromptSuccess({ prompt: null }));
    },
    [allPrompts, collapsedSections, dispatch, folders, prompt, t],
  );

  const handleDelete = useCallback(() => {
    if (prompt.sharedWithMe) {
      dispatch(
        ShareActions.discardSharedWithMe({
          resourceIds: [prompt.id],
          featureType: FeatureType.Prompt,
        }),
      );
    } else {
      dispatch(PromptsActions.deletePrompt({ prompt }));
    }

    dispatch(PromptsActions.setSelectedPrompt({ promptId: undefined }));
  }, [dispatch, prompt]);

  const isPublic = isEntityIdPublic(prompt);
  const isMyPrompt = isMyEntity(prompt, FeatureType.Prompt);

  const promptItems = useMemo(
    () => [
      {
        tooltip: 'Edit prompt',
        display: isMyPrompt,
        dataQa: 'edit-prompt',
        Icon: IconEdit,
        onClick: onEditMode,
      },
      {
        tooltip: 'Export prompt',
        display: true,
        dataQa: 'export-prompt',
        Icon: IconFileArrowRight,
        onClick: () => {
          dispatch(
            ImportExportActions.exportPrompt({
              id: prompt.id,
            }),
          );
        },
      },
      {
        tooltip: 'Duplicate prompt',
        display: true,
        dataQa: 'duplicate-prompt',
        Icon: IconCopy,
        onClick: () => {
          dispatch(PromptsActions.duplicatePrompt(prompt));
        },
      },
      {
        tooltip: 'Move prompt',
        display: isMyPrompt,
        dataQa: 'move-prompt',
        Icon: IconFolderShare,
        onClick: () => {
          setIsShowMoveToModal(true);
        },
      },
      {
        tooltip: 'Share prompt',
        display: isMyPrompt && isSharingEnabled,
        dataQa: 'share-prompt',
        Icon: IconUserShare,
        onClick: () => {
          setIsUnshareConfirmOpened(true);
        },
      },
      {
        tooltip: 'Unshare prompt',
        display: !!prompt.isShared && isSharingEnabled,
        dataQa: 'unshare-prompt',
        Icon: IconUserX,
        onClick: () => {
          dispatch(
            ShareActions.share({
              featureType: FeatureType.Prompt,
              resourceId: prompt.id,
            }),
          );
        },
      },
      {
        tooltip: 'Publish prompt',
        display: !isPublic && isPublishingEnabled,
        dataQa: 'publish-prompt',
        Icon: IconWorldShare,
        onClick: () => {
          setPublishPromptAction(PublishActions.ADD);
        },
      },
      {
        tooltip: 'Unpublish prompt',
        display: isPublic && isPublishingEnabled,
        dataQa: 'publish-prompt',
        Icon: (props) => (
          <UnpublishIcon {...props} style={{ strokeWidth: 1.1 }} />
        ),
        onClick: () => {
          setPublishPromptAction(PublishActions.DELETE);
        },
      },
      {
        tooltip: 'Delete prompt',
        display: isMyEntity || !!prompt.sharedWithMe,
        dataQa: 'delete-prompt',
        Icon: IconTrashX,
        onClick: () => {
          setIsDeleting(true);
        },
      },
      {
        tooltip: 'Prompt info',
        display: true,
        dataQa: 'info-prompt',
        Icon: IconInfoCircle,
        onClick: () => {
          dispatch(ChatActions.getEntityInfo({ entityInfo: prompt }));
        },
      },
    ],
    [
      dispatch,
      isMyPrompt,
      isPublic,
      isPublishingEnabled,
      isSharingEnabled,
      onEditMode,
      prompt,
    ],
  );

  return (
    <>
      {promptItems.map(({ display, ...props }) =>
        display ? <PromptIconBtn key={props.tooltip} {...props} /> : null,
      )}
      {isShowMoveToModal && (
        <MoveToFolderModal
          folders={folders}
          onMoveToFolder={handleMoveToFolder}
          onClose={() => {
            setIsShowMoveToModal(false);
          }}
          featureType={FeatureType.Prompt}
        />
      )}
      {publishPromptAction && (
        <PublishModal
          entity={prompt}
          type={SharingType.Prompt}
          isOpen
          onClose={handleClosePublishModal}
          publishAction={publishPromptAction}
          defaultPath={
            publishPromptAction === PublishActions.DELETE &&
            !isRootId(prompt.folderId)
              ? getIdWithoutRootPathSegments(prompt.folderId)
              : undefined
          }
        />
      )}
      {isDeleting && (
        <ConfirmDialog
          isOpen
          heading={t('Confirm deleting prompt')}
          description={`${t('Are you sure that you want to delete a prompt?')}${t(
            prompt.isShared
              ? '\nDeleting will stop sharing and other users will no longer see this prompt.'
              : '',
          )}`}
          confirmLabel={t('Delete')}
          cancelLabel={t('Cancel')}
          onClose={(result) => {
            if (result) handleDelete();
            setIsDeleting(false);
          }}
        />
      )}
      {isUnshareConfirmOpened && (
        <ConfirmDialog
          isOpen
          heading={t('Confirm unsharing: {{promptName}}', {
            promptName: prompt.name,
          })}
          description={
            t('Are you sure that you want to unshare this prompt?') ?? ''
          }
          confirmLabel={t('Unshare')}
          cancelLabel={t('Cancel')}
          onClose={(result) => {
            setIsUnshareConfirmOpened(false);
            if (result) {
              dispatch(
                ShareActions.revokeAccess({
                  resourceId: prompt.id,
                  featureType: FeatureType.Prompt,
                }),
              );
            }
          }}
        />
      )}
    </>
  );
};

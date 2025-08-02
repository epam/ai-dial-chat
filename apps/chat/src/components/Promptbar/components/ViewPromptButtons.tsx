import {
  IconCopy,
  IconFileArrowRight,
  IconFolderShare,
  IconInfoCircle,
  IconPencilMinus,
  IconProps,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { useMemo } from 'react';

import { usePromptActions } from '@/src/hooks/usePromptActions';
import { useScreenState } from '@/src/hooks/useScreenState';

import { isMyEntity } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { FeatureType, ScreenState } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';

import { useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors, SettingsSelectors } from '@/src/store/selectors';

import { ContextMenu } from '@/src/components/Common/ContextMenu';
import { IconButton } from '@/src/components/Common/IconButton';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { PublishActions } from '@epam/ai-dial-shared';

interface Props {
  prompt: Prompt;
  onEditMode: () => void;
}

const editBtnName = 'Edit';

export const ViewPromptButtons: React.FC<Props> = ({ prompt, onEditMode }) => {
  const {
    handleDuplicate,
    handleExport,
    handleInfo,
    handleShare,
    handleDelete,
    handlePublish,
    handleUnpublish,
    handleMoveToFolder,
  } = usePromptActions(prompt);

  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, FeatureType.Prompt),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, FeatureType.Prompt),
  );
  const { isSelectedPromptApproveRequiredResource } = useAppSelector(
    PromptsSelectors.selectSelectedPromptId,
  );

  const screenState = useScreenState();
  const isPublic = isEntityIdPublic(prompt);
  const isMyPrompt = isMyEntity(prompt);

  const promptItems = useMemo(
    () => [
      {
        name: editBtnName,
        display:
          isMyPrompt ||
          (isSelectedPromptApproveRequiredResource &&
            prompt.publicationInfo?.action !== PublishActions.DELETE),
        dataQa: 'edit-prompt',
        Icon: IconPencilMinus,
        onClick: onEditMode,
      },
      {
        name: 'Duplicate',
        display: true,
        dataQa: 'duplicate-prompt',
        Icon: IconCopy,
        onClick: handleDuplicate,
      },
      {
        name: 'Export',
        display: true,
        dataQa: 'export-prompt',
        Icon: IconFileArrowRight,
        onClick: handleExport,
      },
      {
        name: 'Move to',
        display: isMyPrompt,
        dataQa: 'move-prompt',
        Icon: IconFolderShare,
        onClick: handleMoveToFolder,
      },
      {
        name: 'Share',
        display: isMyPrompt && isSharingEnabled,
        dataQa: 'share-prompt',
        Icon: IconUserShare,
        onClick: handleShare,
      },
      {
        name: 'Publish',
        display: isMyPrompt && isPublishingEnabled,
        dataQa: 'publish-prompt',
        Icon: IconWorldShare,
        onClick: handlePublish,
      },
      {
        name: 'Unpublish',
        display:
          isPublic &&
          isPublishingEnabled &&
          !isSelectedPromptApproveRequiredResource,
        dataQa: 'unpublish-prompt',
        Icon: (props: IconProps) => (
          <UnpublishIcon {...props} style={{ strokeWidth: 1.1 }} />
        ),
        onClick: handleUnpublish,
      },
      {
        name: 'Info',
        display: true,
        dataQa: 'info-prompt',
        Icon: IconInfoCircle,
        onClick: handleInfo,
      },
      {
        name: 'Delete',
        display: isMyPrompt || !!prompt.sharedWithMe,
        dataQa: 'delete-prompt',
        Icon: IconTrashX,
        onClick: handleDelete,
      },
    ],
    [
      isMyPrompt,
      isSelectedPromptApproveRequiredResource,
      prompt.publicationInfo?.action,
      prompt.sharedWithMe,
      onEditMode,
      handleDuplicate,
      handleExport,
      handleMoveToFolder,
      isSharingEnabled,
      handleShare,
      isPublishingEnabled,
      handlePublish,
      isPublic,
      handleUnpublish,
      handleInfo,
      handleDelete,
    ],
  );

  const editBtn = promptItems.find((item) => item.name === editBtnName);

  return (
    <div className="flex h-[34px] gap-2">
      {screenState !== ScreenState.SM ? (
        promptItems.map(({ display, ...props }) =>
          display ? <IconButton key={props.name} {...props} /> : null,
        )
      ) : (
        <>
          <button className="icon-button size-[34px]">
            <ContextMenu
              menuItems={promptItems.filter(
                (item) => item.name !== editBtnName,
              )}
              featureType={FeatureType.Prompt}
              triggerIconHighlight
              className="m-0 xl:invisible group-hover:xl:visible"
            />
          </button>
          {editBtn && <IconButton {...editBtn} />}
        </>
      )}
    </div>
  );
};

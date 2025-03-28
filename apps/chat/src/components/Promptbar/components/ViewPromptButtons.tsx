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

import { usePromptActions } from '@/src/hooks/usePromptActions';

import { isMyEntity } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { FeatureType } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import Tooltip from '@/src/components/Common/Tooltip';

import { PromptDialogs } from './PromptDialogs';

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
  const [isMoveTo, setIsMoveTo] = useState(false);
  const [publishPromptAction, setPublishPromptAction] =
    useState<PublishActions>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnsharing, setIsUnsharing] = useState(false);

  const { handleDuplicate, handleExport, handleInfo, handleShare } =
    usePromptActions(prompt);

  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, FeatureType.Prompt),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, FeatureType.Prompt),
  );

  const handleCloseDialogs = useCallback(() => {
    setIsDeleting(false);
    setIsUnsharing(false);
    setPublishPromptAction(undefined);
    setIsMoveTo(false);
  }, []);

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
        onClick: handleExport,
      },
      {
        tooltip: 'Duplicate prompt',
        display: true,
        dataQa: 'duplicate-prompt',
        Icon: IconCopy,
        onClick: handleDuplicate,
      },
      {
        tooltip: 'Move prompt',
        display: isMyPrompt,
        dataQa: 'move-prompt',
        Icon: IconFolderShare,
        onClick: () => {
          setIsMoveTo(true);
        },
      },
      {
        tooltip: 'Share prompt',
        display: isMyPrompt && isSharingEnabled,
        dataQa: 'share-prompt',
        Icon: IconUserShare,
        onClick: handleShare,
      },
      {
        tooltip: 'Unshare prompt',
        display: !!prompt.isShared && isSharingEnabled,
        dataQa: 'unshare-prompt',
        Icon: IconUserX,
        onClick: () => {
          setIsUnsharing(true);
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
        onClick: handleInfo,
      },
    ],
    [
      handleDuplicate,
      handleExport,
      handleInfo,
      handleShare,
      isMyPrompt,
      isPublic,
      isPublishingEnabled,
      isSharingEnabled,
      onEditMode,
      prompt.isShared,
      prompt.sharedWithMe,
    ],
  );

  const moveToModel = useMemo(
    () => ({
      isOpen: isMoveTo,
      isMobileOnly: false,
    }),
    [isMoveTo],
  );

  return (
    <>
      {promptItems.map(({ display, ...props }) =>
        display ? <PromptIconBtn key={props.tooltip} {...props} /> : null,
      )}
      <PromptDialogs
        prompt={prompt}
        isDeleteDialog={isDeleting}
        isUnshareDialog={isUnsharing}
        publishPromptAction={publishPromptAction}
        onCloseModals={handleCloseDialogs}
        moveTo={moveToModel}
      />
    </>
  );
};

import {
  IconCopy,
  IconFileArrowRight,
  IconFolderShare,
  IconInfoCircle,
  IconPencilMinus,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
  TablerIconsProps,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { usePromptActions } from '@/src/hooks/usePromptActions';
import { useScreenState } from '@/src/hooks/useScreenState';

import { isMyEntity } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { FeatureType, ScreenState } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import ContextMenu from '@/src/components/Common/ContextMenu';
import Tooltip from '@/src/components/Common/Tooltip';

import { PromptDialogs } from './PromptDialogs';

import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import { PublishActions } from '@epam/ai-dial-shared';

interface PromptIconBtnProps {
  name: string;
  dataQa: string;
  Icon: (props: TablerIconsProps) => JSX.Element;
  onClick: () => void;
}

const PromptIconBtn: React.FC<PromptIconBtnProps> = ({
  name,
  dataQa,
  Icon,
  onClick,
}) => {
  const { t } = useTranslation(Translation.PromptBar);

  return (
    <Tooltip placement="top" isTriggerClickable tooltip={t(name)}>
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

const editBtnName = 'Edit';

export const ViewPromptButtons: React.FC<Props> = ({ prompt, onEditMode }) => {
  const [isMoveTo, setIsMoveTo] = useState(false);
  const [publishPromptAction, setPublishPromptAction] =
    useState<PublishActions>();
  const [isDeleting, setIsDeleting] = useState(false);

  const { handleDuplicate, handleExport, handleInfo, handleShare } =
    usePromptActions(prompt);

  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, FeatureType.Prompt),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, FeatureType.Prompt),
  );

  const screenState = useScreenState();

  const handleCloseDialogs = useCallback(() => {
    setIsDeleting(false);
    setPublishPromptAction(undefined);
    setIsMoveTo(false);
  }, []);

  const isPublic = isEntityIdPublic(prompt);
  const isMyPrompt = isMyEntity(prompt, FeatureType.Prompt);

  const promptItems = useMemo(
    () => [
      {
        name: editBtnName,
        display: isMyPrompt,
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
        name: 'Move',
        display: isMyPrompt,
        dataQa: 'move-prompt',
        Icon: IconFolderShare,
        onClick: () => {
          setIsMoveTo(true);
        },
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
        display: !isPublic && isPublishingEnabled,
        dataQa: 'publish-prompt',
        Icon: IconWorldShare,
        onClick: () => {
          setPublishPromptAction(PublishActions.ADD);
        },
      },
      {
        name: 'Unpublish',
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
        onClick: () => {
          setIsDeleting(true);
        },
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

  const editBtn = promptItems.find((item) => item.name === editBtnName);

  return (
    <>
      <div className="flex h-[34px] gap-2">
        {screenState !== ScreenState.SM ? (
          <>
            {promptItems.map(({ display, ...props }) =>
              display ? <PromptIconBtn key={props.name} {...props} /> : null,
            )}
          </>
        ) : (
          <>
            <button className="icon-button size-[34px]">
              <ContextMenu
                menuItems={promptItems.filter(
                  (item) => item.name !== editBtnName,
                )}
                featureType={FeatureType.Application}
                triggerIconHighlight
                className="m-0 xl:invisible group-hover:xl:visible"
              />
            </button>
            {editBtn && <PromptIconBtn {...editBtn} />}
          </>
        )}
      </div>
      <PromptDialogs
        prompt={prompt}
        isDeleteDialog={isDeleting}
        publishPromptAction={publishPromptAction}
        onCloseModals={handleCloseDialogs}
        moveTo={moveToModel}
      />
    </>
  );
};

import {
  IconCopy,
  IconDots,
  IconEye,
  IconFileArrowRight,
  IconFolderShare,
  IconInfoCircle,
  IconPencilMinus,
  IconPlayerPlay,
  IconRefreshDot,
  IconScale,
  IconSquareCheck,
  IconTrashX,
  IconUserShare,
  IconWorldShare,
} from '@tabler/icons-react';
import { MouseEventHandler, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  hasInvalidNameInPath,
  isEntityNameInvalid,
} from '@/src/utils/app/common';
import { isConversationWithFormSchema } from '@/src/utils/app/form-schema';
import { isEntityIdExternal } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { ContextMenuProps, DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors, SettingsSelectors } from '@/src/store/selectors';

import { ContextMenu } from './ContextMenu';

import InsertPromptIcon from '@/public/images/icons/insert-prompt.svg';
import UnpublishIcon from '@/public/images/icons/unpublish.svg';
import IconUserUnshare from '@/public/images/icons/unshare-user.svg';
import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';

interface ItemContextMenuProps {
  entity: ShareEntity;
  featureType: FeatureType;
  isEmptyConversation?: boolean;
  className?: string;
  isOpen?: boolean;
  useStandardColor?: boolean;
  onOpenMoveToModal: () => void;
  onOpenExportModal?: () => void;
  onDelete: MouseEventHandler<unknown>;
  onRename?: MouseEventHandler<unknown>;
  onExport: (args?: unknown) => void;
  onReplay?: MouseEventHandler<unknown>;
  onCompare?: MouseEventHandler<unknown>;
  onPlayback?: MouseEventHandler<unknown>;
  onShare?: MouseEventHandler<unknown>;
  onUnshare?: MouseEventHandler<unknown>;
  onPublish?: MouseEventHandler<unknown>;
  onUnpublish?: MouseEventHandler<unknown>;
  onOpenChange?: (isOpen: boolean) => void;
  onDuplicate?: MouseEventHandler<unknown>;
  onView?: MouseEventHandler<unknown>;
  onSelect?: MouseEventHandler<unknown>;
  disableUse?: boolean;
  onUse?: MouseEventHandler<unknown>;
  isLoading?: boolean;
  TriggerIcon?: ContextMenuProps['TriggerIcon'];
  onShowInfo?: () => void;
  hideTriggerIcon?: boolean;
}

export function ItemContextMenu({
  entity,
  featureType,
  isEmptyConversation,
  className,
  isOpen,
  useStandardColor,
  onDelete,
  onRename,
  onExport,
  onOpenExportModal,
  onReplay,
  onCompare,
  onPlayback,
  onOpenMoveToModal,
  onShare,
  onUnshare,
  onPublish,
  onUnpublish,
  onOpenChange,
  onDuplicate,
  onView,
  isLoading,
  onSelect,
  disableUse,
  onUse,
  onShowInfo,
  TriggerIcon,
  hideTriggerIcon,
}: ItemContextMenuProps) {
  const { t } = useTranslation(Translation.SideBar);

  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, featureType),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, featureType),
  );
  const isApproveRequiredEntity = useAppSelector((state) =>
    PublicationSelectors.selectIsApproveRequiredEntity(state, entity.id),
  );

  const isExternal = isEntityIdExternal(entity);
  const isNameInvalid = isEntityNameInvalid(entity.name);
  const isInvalidPath = hasInvalidNameInPath(entity.folderId);
  const disableAll = isNameInvalid || isInvalidPath;

  const isFormSchemaConversation =
    featureType === FeatureType.Chat &&
    isConversationWithFormSchema(entity as Conversation);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Use'),
        display: !!onUse,
        disabled: disableUse,
        dataQa: 'use',
        Icon: InsertPromptIcon,
        onClick: onUse,
      },
      {
        name: t('View'),
        display: !!onView,
        dataQa: 'view',
        Icon: IconEye,
        onClick: onView,
      },
      {
        name: t('Select'),
        display: !isExternal && !!onSelect,
        dataQa: 'select',
        Icon: IconSquareCheck,
        onClick: onSelect,
      },
      {
        name: t(featureType === FeatureType.Chat ? 'Rename' : 'Edit'),
        display:
          (!isExternal || isApproveRequiredEntity) &&
          entity.publicationInfo?.action !== PublishActions.DELETE &&
          !!onRename,
        dataQa: 'rename',
        Icon: IconPencilMinus,
        onClick: onRename,
        disabled: disableAll && !isNameInvalid,
      },
      {
        name: t('Compare'),
        display: !!onCompare && !isFormSchemaConversation,
        dataQa: 'compare',
        Icon: IconScale,
        onClick: onCompare,
        disabled: disableAll,
      },
      {
        name: t('Duplicate'),
        display: !isEmptyConversation && !!onDuplicate,
        dataQa: 'duplicate',
        Icon: IconCopy,
        onClick: onDuplicate,
        disabled: disableAll,
      },
      {
        name: t('Replay'),
        display:
          !isEmptyConversation && !!onReplay && !isFormSchemaConversation,
        dataQa: 'replay',
        Icon: IconRefreshDot,
        onClick: onReplay,
        disabled: disableAll,
      },
      {
        name: t('Playback'),
        display: !isEmptyConversation && !!onPlayback,
        dataQa: 'playback',
        Icon: IconPlayerPlay,
        onClick: onPlayback,
        disabled: disableAll,
      },
      {
        name: t('Export'),
        dataQa: 'export-prompt',
        display: featureType === FeatureType.Prompt,
        Icon: IconFileArrowRight,
        onClick: onExport,
      },
      {
        name: t('Export'),
        dataQa: 'export-chat-mobile',
        display: !isEmptyConversation && featureType === FeatureType.Chat,
        Icon: IconFileArrowRight,
        onClick: onOpenExportModal,
        className: 'md:hidden',
      },
      {
        name: t('Export'),
        display: !isEmptyConversation && featureType === FeatureType.Chat,
        dataQa: 'export-chat',
        Icon: IconFileArrowRight,
        className: 'max-md:hidden',
        childMenuItems: [
          {
            name: t('With attachments'),
            dataQa: 'with-attachments',
            onClick: () => {
              onExport({ withAttachments: true });
            },
            className: 'invisible md:visible',
          },
          {
            name: t('Without attachments'),
            dataQa: 'without-attachments',
            onClick: () => {
              onExport();
            },
            className: 'invisible md:visible',
          },
        ],
      },
      {
        name: t('Move to'),
        display: !isExternal,
        dataQa: 'move-to-modal',
        Icon: IconFolderShare,
        onClick: onOpenMoveToModal,
        disabled: disableAll,
      },
      {
        name: t('Share'),
        dataQa: 'share',
        display:
          !isEmptyConversation && isSharingEnabled && !!onShare && !isExternal,
        Icon: IconUserShare,
        onClick: onShare,
        disabled: disableAll,
      },
      {
        name: t('Unshare'),
        dataQa: 'unshare',
        display: !!entity.sharedWithMe,
        Icon: IconUserUnshare,
        onClick: onUnshare,
        disabled: disableAll,
      },
      {
        name: t('Publish'),
        dataQa: 'publish',
        display:
          !isEmptyConversation &&
          isPublishingEnabled &&
          !entity.isPublished &&
          !!onPublish &&
          !isExternal,
        Icon: IconWorldShare,
        onClick: onPublish,
        disabled: disableAll,
      },
      {
        name: t('Unpublish'),
        dataQa: 'unpublish',
        display:
          isPublishingEnabled && !!onUnpublish && isEntityIdPublic(entity),
        Icon: UnpublishIcon,
        onClick: onUnpublish,
        disabled: disableAll,
      },
      {
        name: t('Info'),
        display: !!onShowInfo,
        dataQa: 'info',
        Icon: IconInfoCircle,
        onClick: onShowInfo,
      },
      {
        name: t('Delete'),
        dataQa: 'delete',
        display: !isExternal,
        Icon: IconTrashX,
        onClick: onDelete,
      },
    ],
    [
      t,
      onUse,
      disableUse,
      onView,
      isExternal,
      onSelect,
      featureType,
      isApproveRequiredEntity,
      entity,
      onRename,
      disableAll,
      isNameInvalid,
      onCompare,
      isFormSchemaConversation,
      isEmptyConversation,
      onDuplicate,
      onReplay,
      onPlayback,
      onExport,
      onOpenExportModal,
      onOpenMoveToModal,
      isSharingEnabled,
      onShare,
      onUnshare,
      isPublishingEnabled,
      onPublish,
      onUnpublish,
      onShowInfo,
      onDelete,
    ],
  );

  return (
    <ContextMenu
      menuItems={menuItems}
      isLoading={isLoading}
      TriggerIcon={TriggerIcon ?? IconDots}
      hideTriggerIcon={hideTriggerIcon}
      triggerIconSize={18}
      className={className}
      featureType={featureType}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      useStandardColor={useStandardColor}
    />
  );
}

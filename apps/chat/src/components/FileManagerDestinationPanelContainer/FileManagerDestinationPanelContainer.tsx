import {
  DestinationRestriction,
  useFileManagerDestination,
  type UseDialFileManagerResult,
} from '@epam/ai-dial-chat-hooks';
import {
  FolderDestinationItemIcon,
  FolderDestinationLayout,
  FolderDestinationPanel,
} from '@epam/ai-dial-folder-destination-panel';
import {
  DestinationFolderMode,
  DialFileNodeType,
  type DialDestinationRequest,
} from '@epam/ai-dial-react-file-manager';
import {
  CaptionText,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  LiveRegion,
} from '@epam/ai-dial-ui-kit';
import { IconCopy, IconFolderShare } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
  ConversationPublishI18nKeys,
  DialFileManagerI18nKeys,
  ResourceSavePanelI18nKeys,
} from '../../constants/translation-keys';
import { getPublishPanelCommonLabels } from '../../utils/publish';

interface Props {
  /** The Copy or Move the user started in the file manager. */
  request: DialDestinationRequest;
  /** The file manager's state: its folders, preloading and folder creation. */
  hookResult: Pick<
    UseDialFileManagerResult,
    | 'items'
    | 'folderPopupLoadingPaths'
    | 'onFolderPopupPathChange'
    | 'onCreateFolder'
  >;
  /** Called once the panel is dismissed or the operation has been confirmed. */
  onClose: () => void;
}

/** App adapter that shows the folder destination panel for a file-manager Copy or Move and confirms the chosen folder. */
const FileManagerDestinationPanelContainer: FC<Props> = ({
  request,
  hookResult,
  onClose,
}) => {
  const { t } = useTranslation();
  const isCopy = request.mode === DestinationFolderMode.Copy;
  const {
    roots,
    destination,
    onDestinationChange,
    onCreateFolder,
    destinationVirtualPath,
    isDestinationLoading,
    restriction,
  } = useFileManagerDestination({
    request,
    items: hookResult.items,
    loadingPaths: hookResult.folderPopupLoadingPaths,
    onPreloadFolder: hookResult.onFolderPopupPathChange,
    onCreateFolder: hookResult.onCreateFolder,
  });

  let unavailableReason: string | undefined;
  if (isDestinationLoading) {
    unavailableReason = t(DialFileManagerI18nKeys.FolderPickerLoadingTooltip);
  } else if (restriction === DestinationRestriction.SourceFolder) {
    unavailableReason = t(DialFileManagerI18nKeys.MoveSourceDisabledTooltip);
  } else if (restriction === DestinationRestriction.IntoItself) {
    unavailableReason = t(DialFileManagerI18nKeys.MovedIntoItselfTooltip);
  }

  const handleCancel = useCallback(() => {
    request.cancel();
    onClose();
  }, [onClose, request]);

  const handleConfirm = useCallback(() => {
    if (destinationVirtualPath == null) return;
    request.confirm(destinationVirtualPath);
    onClose();
  }, [destinationVirtualPath, onClose, request]);

  const itemName = request.items[0]?.name;
  const itemCount = request.items.length;
  const isSingleFolder =
    itemCount === 1 && request.items[0]?.nodeType === DialFileNodeType.FOLDER;
  let title: string;
  if (itemCount !== 1) {
    title = t(
      isCopy
        ? DialFileManagerI18nKeys.CopyHeaderMultiple
        : DialFileManagerI18nKeys.MoveHeaderMultiple,
      { count: itemCount },
    );
  } else if (isSingleFolder) {
    title = t(
      isCopy
        ? DialFileManagerI18nKeys.CopyTitleFolder
        : DialFileManagerI18nKeys.MoveTitleFolder,
    );
  } else {
    title = t(
      isCopy
        ? DialFileManagerI18nKeys.CopyTitleFile
        : DialFileManagerI18nKeys.MoveTitleFile,
    );
  }

  let item: { title: string; iconKind?: FolderDestinationItemIcon };
  if (itemCount === 1 && itemName != null) {
    item = {
      title: itemName,
      iconKind: isSingleFolder
        ? FolderDestinationItemIcon.Folder
        : FolderDestinationItemIcon.File,
    };
  } else {
    item = {
      title: t(DialFileManagerI18nKeys.SelectedItemsSummary, {
        count: itemCount,
      }),
    };
  }

  const commonLabels = getPublishPanelCommonLabels(t);
  const panelLabels = useMemo(
    () => ({
      destinationHeading: t(
        isCopy
          ? DialFileManagerI18nKeys.CopyToFolderHeading
          : DialFileManagerI18nKeys.MoveToFolderHeading,
      ),
      changeFolderLabel: t(ResourceSavePanelI18nKeys.ChangeFolder),
      destinationAriaLabel: t(ResourceSavePanelI18nKeys.DestinationAriaLabel),
      searchPlaceholder: t(CatalogI18nKeys.PublishFolderSearchPlaceholder),
      clearSearchAriaLabel: commonLabels.clearSearchAriaLabel,
      folderEmptyStateLabel: t(CatalogI18nKeys.PublishFolderEmptyState),
      cancelCreatingFolderLabel: t(ButtonsI18nKeys.Cancel),
      addSiblingFolderLabel: commonLabels.addSiblingFolderLabel,
      addChildFolderLabel: commonLabels.addChildFolderLabel,
      createFolderEmptyNameError: t(
        ConversationPublishI18nKeys.EmptyFolderNameError,
      ),
      createFolderInvalidNameError: t(
        ConversationPublishI18nKeys.InvalidFolderNameError,
      ),
      createFolderDuplicateNameError: t(
        ConversationPublishI18nKeys.DuplicateFolderNameError,
      ),
      createFolderSameAsParentNameError: t(
        ConversationPublishI18nKeys.SameAsParentFolderNameError,
      ),
      retryLabel: t(ButtonsI18nKeys.Retry),
    }),
    [
      commonLabels.addChildFolderLabel,
      commonLabels.addSiblingFolderLabel,
      commonLabels.clearSearchAriaLabel,
      isCopy,
      t,
    ],
  );
  const labels = useMemo(
    () => ({
      title,
      changeFolderTitle: t(ResourceSavePanelI18nKeys.ChangeFolderTitle),
      closeAriaLabel: t(ButtonsI18nKeys.Close),
      backAriaLabel: t(ButtonsI18nKeys.Back),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      selectLabel: t(ButtonsI18nKeys.Select),
    }),
    [t, title],
  );

  return (
    <FolderDestinationPanel
      isOpen
      onClose={handleCancel}
      item={item}
      layout={FolderDestinationLayout.Inline}
      collapsibleRoots
      roots={roots}
      destination={destination}
      onDestinationChange={onDestinationChange}
      onCreateFolder={onCreateFolder}
      action={{
        label: t(
          isCopy
            ? ButtonsI18nKeys.Copy
            : DialFileManagerI18nKeys.MoveButtonLabel,
        ),
        icon: isCopy ? (
          <IconCopy
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
            aria-hidden
          />
        ) : (
          <IconFolderShare
            size={DIAL_ICON_SIZE.SM}
            stroke={DIAL_KIT_ICON_STROKE}
            aria-hidden
          />
        ),
        onClick: handleConfirm,
        isDisabled: unavailableReason != null || destinationVirtualPath == null,
      }}
      mainSections={
        <LiveRegion>
          {unavailableReason && <CaptionText text={unavailableReason} />}
        </LiveRegion>
      }
      labels={labels}
      panelLabels={panelLabels}
    />
  );
};

export default memo(FileManagerDestinationPanelContainer);

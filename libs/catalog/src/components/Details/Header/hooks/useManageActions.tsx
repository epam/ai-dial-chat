import { buildCssVars } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconPencil,
  IconDownload,
  IconShare,
  IconTrashX,
  IconUserOff,
  IconWorldOff,
  IconWorldShare,
} from '@tabler/icons-react';
import { useMemo } from 'react';
import type {
  HeaderProps,
  ManageAction,
} from '../../../../models/details-header';
import type { resolveHeaderActionVisibility } from '../../../../utils/details-header-actions';
import styles from '../Header.module.scss';

/** Parameters for {@link useManageActions}. */
export interface UseManageActionsParams extends Pick<
  HeaderProps,
  'texts' | 'detailsStyles'
> {
  /** Action visibility, from `resolveHeaderActionVisibility`. */
  visibility: ReturnType<typeof resolveHeaderActionVisibility>;
  /** Resolved recipient count, shown in the "Revoke access" label. */
  recipientsCount: number | undefined;
  /** Whether the Manage menu is open; an open menu is never promoted to a button. */
  isManageMenuOpen: boolean;
  /** Header handler run by the matching Manage entry. */
  handleShare: () => void;
  /** Header handler run by the matching Manage entry. */
  handleEdit: () => void;
  /** Header handler run by the matching Manage entry. */
  handleDownload: () => void;
  /** Header handler run by the matching Manage entry. */
  handleOpenPublish: () => void;
  /** Header handler run by the matching Manage entry. */
  handleOpenUnpublish: () => void;
  /** Header handler run by the matching Manage entry. */
  handleDelete: () => void;
  /** Header handler run by the matching Manage entry. */
  handleRevokeShare: () => void;
  /** Header handler run by the matching Manage entry. */
  handleUnshare: () => void;
}

/** Manage-menu model of the details header: its entries, menu items, and the entry promoted to a button. */
export const useManageActions = ({
  visibility,
  texts,
  detailsStyles,
  recipientsCount,
  isManageMenuOpen,
  handleShare,
  handleEdit,
  handleDownload,
  handleOpenPublish,
  handleOpenUnpublish,
  handleDelete,
  handleRevokeShare,
  handleUnshare,
}: UseManageActionsParams) => {
  const {
    isShareInActionRow,
    shouldShowShareAction,
    shouldShowEditAction,
    shouldShowDownloadAction,
    isPublishInActionRow,
    shouldShowPublish,
    shouldShowUnpublish,
    shouldShowDeleteAction,
    shouldShowRevokeShareAction,
    shouldShowUnshareAction,
    mayGainUnpublishEntry,
    mayGainRevokeShareEntry,
  } = visibility;

  const manageActions = useMemo<ManageAction[]>(() => {
    const items: ManageAction[] = [];
    if (!isShareInActionRow && shouldShowShareAction) {
      items.push({
        key: 'share',
        label: texts?.shareLabel ?? 'Share',
        Icon: IconShare,
        iconClassName: styles.manageMenuIcon,
        onClick: handleShare,
      });
    }
    if (shouldShowEditAction) {
      items.push({
        key: 'edit',
        label: texts?.editActionLabel ?? 'Edit',
        Icon: IconPencil,
        iconClassName: styles.manageMenuIcon,
        onClick: handleEdit,
      });
    }
    if (shouldShowDownloadAction) {
      items.push({
        key: 'download',
        label: texts?.downloadActionLabel ?? 'Download',
        Icon: IconDownload,
        iconClassName: styles.manageMenuIcon,
        onClick: handleDownload,
      });
    }
    if (!isPublishInActionRow && shouldShowPublish) {
      items.push({
        key: 'publish',
        label: texts?.publishLabel ?? 'Publish',
        Icon: IconWorldShare,
        iconClassName: styles.manageMenuIcon,
        onClick: handleOpenPublish,
      });
    }
    if (!isPublishInActionRow && shouldShowUnpublish) {
      /* Not `danger`: unpublishing removes a published copy but destroys
       * nothing the owner holds — the source item is untouched and can be
       * published again — so it sits with Edit/Download/Publish. */
      items.push({
        key: 'unpublish',
        label: texts?.unpublishLabel ?? 'Unpublish',
        Icon: IconWorldOff,
        iconClassName: styles.manageMenuIcon,
        onClick: handleOpenUnpublish,
      });
    }
    if (shouldShowRevokeShareAction) {
      const revokeShareLabel = texts?.revokeShareLabel ?? 'Revoke access';
      const formatWithCount =
        texts?.revokeShareLabelWithCount ??
        ((count: number) => `${revokeShareLabel} (${count})`);
      items.push({
        key: 'revoke-share',
        label:
          recipientsCount == null
            ? revokeShareLabel
            : formatWithCount(recipientsCount),
        Icon: IconUserOff,
        danger: true,
        onClick: handleRevokeShare,
      });
    }
    if (shouldShowUnshareAction) {
      items.push({
        key: 'unshare',
        label: texts?.unshareLabel ?? 'Remove from My List',
        Icon: IconTrashX,
        onClick: handleUnshare,
      });
    }
    /* Last, and after the access actions: the destructive entry closes the
     * menu so it is never the neighbour of something a misclick can reach. */
    if (shouldShowDeleteAction) {
      items.push({
        key: 'delete',
        label: texts?.deleteActionLabel ?? 'Delete',
        Icon: IconTrashX,
        danger: true,
        onClick: handleDelete,
      });
    }
    return items;
  }, [
    isShareInActionRow,
    shouldShowShareAction,
    shouldShowEditAction,
    shouldShowDownloadAction,
    isPublishInActionRow,
    shouldShowPublish,
    shouldShowUnpublish,
    shouldShowDeleteAction,
    shouldShowRevokeShareAction,
    recipientsCount,
    shouldShowUnshareAction,
    texts,
    handleShare,
    handleEdit,
    handleDownload,
    handleOpenPublish,
    handleOpenUnpublish,
    handleDelete,
    handleRevokeShare,
    handleUnshare,
  ]);

  const manageMenuIcon = detailsStyles?.colors?.manageMenuIcon;
  const manageMenuIconVars = useMemo(
    () => buildCssVars({ '--cat-details-manage-menu-icon': manageMenuIcon }),
    [manageMenuIcon],
  );
  const manageItems = useMemo<DropdownItem[]>(
    () =>
      manageActions.map(
        ({ key, label, Icon, iconClassName, danger, onClick }) => ({
          key,
          label,
          icon: (
            <Icon
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              className={iconClassName}
              style={manageMenuIconVars}
              stroke={DIAL_KIT_ICON_STROKE}
            />
          ),
          danger,
          onClick,
        }),
      ),
    [manageActions, manageMenuIconVars],
  );

  /*
   * An overflow menu holding a single entry costs a click for nothing and
   * leaves the header looking empty until it is opened — which is how a
   * read-only shared item, whose only surviving action is "Remove from My
   * List", ended up with no visible action at all ([#8989](https://github.com/epam/ai-dial-chat/issues/8989)). So the last
   * action standing is rendered as a button in the action row instead.
   *
   * Two entries resolve lazily off the Manage trigger, and the trigger is
   * what starts their lookups: "Unpublish" needs the publish history and
   * "Revoke access" needs the recipient count. An item that could produce
   * either keeps its menu whatever the lookup eventually says, because the
   * decision has to hold still — gating on the pending state instead would
   * turn the button back into a kebab under the pointer that was reaching
   * for it, the hover having settled the lookup on the way in.
   *
   * "Unpublish" is released from that hold once the history has settled for
   * an item the host affirmatively calls unpublishable, because the details
   * panel resolves those up front rather than on hover. That is what lets an
   * Organization copy, whose only action is "Unpublish", show it as a button
   * ([#8989](https://github.com/epam/ai-dial-chat/issues/8989)). A host with no unpublish rule gets no up-front lookup, so its
   * items keep the hold.
   */
  /*
   * Never while the menu is open either. The set can still shrink to one
   * from a prop the host resolves late, and promoting then unmounts the
   * trigger the open overlay hangs from, taking the overlay with it.
   */
  const promotedManageAction =
    manageActions.length === 1 &&
    !isManageMenuOpen &&
    !mayGainUnpublishEntry &&
    !mayGainRevokeShareEntry
      ? manageActions[0]
      : undefined;

  return { manageItems, promotedManageAction };
};

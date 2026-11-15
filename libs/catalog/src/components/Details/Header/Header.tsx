import { EntityHeader, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  FolderPath,
  LiveRegion,
  LiveRegionElement,
  NeutralButton,
  PrimaryButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import {
  IconDownload,
  IconPlayerPlayFilled,
  IconWorldOff,
  IconWorldShare,
} from '@tabler/icons-react';
import { FC, useCallback, useEffect, useState } from 'react';
import type { HeaderProps } from '../../../models/details-header';
import { CatalogLimitStatus } from '../../../models/item-details-data';
import { resolveHeaderActionVisibility } from '../../../utils/details-header-actions';
import styles from './Header.module.scss';
import { HeaderCredentialsButton } from './HeaderCredentialsButton';
import { HeaderManageSlot } from './HeaderManageSlot';
import { useManageActions } from './hooks/useManageActions';
import { useRecipientsCount } from './hooks/useRecipientsCount';
import { LimitStatusBadge } from './LimitStatusBadge';
import { ShareButton } from './ShareButton/ShareButton';

export type { HeaderProps } from '../../../models/details-header';

/** Details panel header bar: entity identity (icon + name + version), action buttons (primary action, Share, a "Manage" menu for Edit, Publish or Unpublish, and Delete — or that action as a button of its own where filtering leaves only one), and inline credentials section. For Toolsets, the credentials action (Log in / Log out / manage) renders first and styled as the primary action, since Toolsets have no "Use in chat" action. Shows a "Running low"/"Limit reached" badge from `item.details?.limits?.status`, disabling "Use in chat" once a limit is reached. */
export const Header: FC<HeaderProps> = ({
  item,
  onUseInChat,
  isPrimaryActionVisible,
  onShare,
  shareOverlay,
  isShareVisible,
  isSharePrimary,
  onEdit,
  onDownload,
  isDownloadVisible,
  isDownloadPrimary,
  onDelete,
  onUnshare,
  isUnshareVisible,
  onRevokeShare,
  onFetchRecipientsCount,
  isRevokeShareVisible,
  onLogin,
  onLogout,
  onOpenCredentialsManagement,
  onRequestLogout,
  texts,
  detailsStyles,
  isPublishVisible,
  isPublishPrimary,
  onOpenPublish,
  isUnpublishVisible,
  hasPublishedFolders = false,
  isPublishHistoryResolved = true,
  onRequestPublishHistory,
  onOpenUnpublish,
  isReadonly = false,
}) => {
  const {
    nameClassName = 'dial-body-semi-text',
    folderLabelClassName = 'dial-tiny-text',
    folderLeafClassName = 'dial-tiny-semi-text',
    limitStatusBadgeClassName = 'dial-caption-lead-semi-text',
  } = detailsStyles?.typography ?? {};

  const limitStatus = item.details?.limits?.status;
  const statusBadge =
    limitStatus != null ? (
      <LimitStatusBadge
        status={limitStatus}
        className={limitStatusBadgeClassName}
        label={
          limitStatus === CatalogLimitStatus.LimitReached
            ? (texts?.limitReachedLabel ?? 'Limit reached')
            : (texts?.limitRunningLowLabel ?? 'Running low')
        }
      />
    ) : undefined;

  const handleUseInChat = useCallback(() => {
    onUseInChat?.(item);
  }, [item, onUseInChat]);

  const handleEdit = useCallback(() => {
    onEdit?.(item);
  }, [item, onEdit]);

  const handleOpenPublish = useCallback(() => {
    onOpenPublish?.();
  }, [onOpenPublish]);

  const handleOpenUnpublish = useCallback(() => {
    onOpenUnpublish?.();
  }, [onOpenUnpublish]);

  /* Fire-and-forget by contract: the host reports its own failures. */
  const handleDownload = useCallback(() => {
    void onDownload?.(item);
  }, [item, onDownload]);

  /*
   * The promoted primary-action Download button, unlike the Manage-menu
   * entry above, awaits the call so it can show a pending/disabled state.
   * `isDownloading` only ever transitions true -> false once a call is in
   * flight, so resetting it on `item.id` change (below) cannot be raced by a
   * stale call settling for a since-abandoned item.
   */
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setIsDownloading(false);
  }, [item.id]);

  const handleDownloadPrimary = useCallback(() => {
    if (isDownloading) return;
    setIsDownloading(true);
    const run = async () => {
      try {
        await onDownload?.(item);
      } catch {
        /* The host owns failure feedback (e.g. a notification); this button
         * only needs to know the call has settled, to clear its own pending state. */
      } finally {
        setIsDownloading(false);
      }
    };
    void run();
  }, [item, onDownload, isDownloading]);

  /*
   * Open state for the Share popover in the Manage-menu arrangement only. The
   * header-button arrangement keeps its own state inside `ShareButton`, which
   * anchors the popover to the button itself; here the entry that opened it is
   * unmounted by the time the popover appears, so the state and the anchor
   * both have to live out here.
   */
  const [isShareOverlayOpen, setIsShareOverlayOpen] = useState(false);

  useEffect(() => {
    setIsShareOverlayOpen(false);
  }, [item.id]);

  const handleShare = useCallback(() => {
    if (shareOverlay) {
      setIsShareOverlayOpen(true);
      return;
    }
    onShare?.(item);
  }, [item, onShare, shareOverlay]);

  const handleCloseShareOverlay = useCallback(() => {
    setIsShareOverlayOpen(false);
  }, []);

  const handleUnshare = useCallback(() => {
    onUnshare?.(item);
  }, [item, onUnshare]);

  const handleDelete = useCallback(() => {
    onDelete?.(item);
  }, [item, onDelete]);

  const handleRevokeShare = useCallback(() => {
    onRevokeShare?.(item);
  }, [item, onRevokeShare]);

  const { recipientsCountStatus, recipientsCount, requestRecipientsCount } =
    useRecipientsCount({
      item,
      onFetchRecipientsCount,
      onRevokeShare,
      isRevokeShareVisible,
    });

  const [isManageMenuOpen, setIsManageMenuOpen] = useState(false);

  useEffect(() => {
    setIsManageMenuOpen(false);
  }, [item.id]);

  const handleManageOpenChange = useCallback(
    (isOpen: boolean) => {
      setIsManageMenuOpen(isOpen);
      if (!isOpen) return;
      requestRecipientsCount();
      onRequestPublishHistory?.();
    },
    [requestRecipientsCount, onRequestPublishHistory],
  );

  /*
   * Both lookups share one hover/focus trigger, so each is issued at most once
   * per item before the click lands. The publish-history lookup stays wired to
   * this trigger in either arrangement: with Publish promoted to the row, an
   * item whose Publish button is hidden by `isPublishVisible` would otherwise
   * have nothing to hover, and its "Unpublish" state could never resolve.
   */
  const handleManageTriggerIntent = useCallback(() => {
    requestRecipientsCount();
    onRequestPublishHistory?.();
  }, [requestRecipientsCount, onRequestPublishHistory]);

  /* The promoted publish button's identity — "Publish" or "Unpublish" —
   * depends on the same lookup, so reaching for it starts the request before
   * the click lands. */
  const handlePublishTriggerIntent = useCallback(() => {
    onRequestPublishHistory?.();
  }, [onRequestPublishHistory]);

  const visibility = resolveHeaderActionVisibility({
    item,
    texts,
    isReadonly,
    isPrimaryActionVisible,
    onOpenUnpublish,
    hasPublishedFolders,
    isUnpublishVisible,
    isPublishHistoryResolved,
    isPublishVisible,
    onEdit,
    isShareVisible,
    isSharePrimary,
    isPublishPrimary,
    onLogin,
    onLogout,
    onDownload,
    isDownloadVisible,
    isDownloadPrimary,
    onUnshare,
    isUnshareVisible,
    onRevokeShare,
    onFetchRecipientsCount,
    isRevokeShareVisible,
    recipientsCountStatus,
    recipientsCount,
  });
  const {
    shouldShowPrimaryAction,
    shouldShowUnpublish,
    isUnpublishPending,
    shouldShowPublish,
    shouldShowShareAction,
    isShareInActionRow,
    isPublishInActionRow,
    authenticationType,
    credentialsUiState,
    shouldShowCredentialsAction,
    isCredentialsActionPrimary,
    isDownloadActionPrimary,
    isApiKeyConfigured,
    isOAuthLogoutState,
  } = visibility;

  const { manageItems, promotedManageAction } = useManageActions({
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
  });

  const credentialsButtonProps = {
    item,
    authenticationType,
    credentialsUiState,
    onLogin,
    onLogout,
    onOpenCredentialsManagement,
    onRequestLogout,
    texts,
    detailsStyles,
  };

  /*
   * The action row renders only when it has content: an empty flex child
   * would still hold the parent's `gap-3` open, leaving dead space between
   * the entity header and the sections below it on surfaces that hide every
   * action (e.g. a read-only details panel).
   */
  const hasActionRowContent =
    isCredentialsActionPrimary ||
    shouldShowPrimaryAction ||
    isDownloadActionPrimary ||
    (isShareInActionRow && shouldShowShareAction) ||
    (isPublishInActionRow && shouldShowUnpublish) ||
    (isPublishInActionRow && shouldShowPublish) ||
    (shouldShowCredentialsAction && !isCredentialsActionPrimary) ||
    (manageItems.length > 0 && !isUnpublishPending);

  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      <EntityHeader
        item={item}
        iconSize={52}
        nameClassName={mergeClasses(nameClassName, styles.name)}
        featuredLabel={texts?.featuredLabel ?? 'Featured'}
        typeLabel={texts?.entityTypeLabels?.[item.type]}
        featuredChipStyle={detailsStyles?.colors?.featuredChipStyle}
        statusBadge={statusBadge}
        footer={
          item.folder.length > 0 ? (
            <FolderPath
              segments={item.folder}
              labelClassName={folderLabelClassName}
              leafClassName={folderLeafClassName}
            />
          ) : undefined
        }
      />
      {hasActionRowContent && (
        <div className="flex flex-wrap items-center gap-2 ps-[60px]">
          {isCredentialsActionPrimary && (
            <HeaderCredentialsButton
              buttonComponent={
                isApiKeyConfigured || isOAuthLogoutState
                  ? NeutralButton
                  : PrimaryButton
              }
              {...credentialsButtonProps}
            />
          )}
          {shouldShowPrimaryAction && (
            <PrimaryButton
              label={texts?.primaryActionLabel ?? 'Use in chat'}
              iconBefore={<IconPlayerPlayFilled size={DIAL_ICON_SIZE.MD} />}
              onClick={handleUseInChat}
              disabled={limitStatus === CatalogLimitStatus.LimitReached}
            />
          )}
          {isDownloadActionPrimary && (
            <>
              <PrimaryButton
                label={texts?.downloadActionLabel ?? 'Download'}
                iconBefore={
                  isDownloading ? (
                    <Spinner size={DIAL_ICON_SIZE.MD} aria-hidden />
                  ) : (
                    <IconDownload
                      size={DIAL_ICON_SIZE.MD}
                      aria-hidden
                      stroke={DIAL_KIT_ICON_STROKE}
                    />
                  )
                }
                onClick={handleDownloadPrimary}
                disabled={isDownloading}
                aria-busy={isDownloading}
              />
              {/* Always mounted so the polite region exists before the download starts. */}
              <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
                {isDownloading
                  ? (texts?.downloadingStatusLabel ?? 'Downloading')
                  : ''}
              </LiveRegion>
            </>
          )}
          {isShareInActionRow && shouldShowShareAction && (
            <ShareButton
              item={item}
              onShare={onShare}
              shareOverlay={shareOverlay}
              isShareVisible={isShareVisible}
              label={texts?.shareLabel}
            />
          )}
          {/* Promoted out of the Manage menu by `isPublishPrimary`, for hosts
           * where publishing is the action owners reach for most after using an
           * item. "Unpublish" takes the same slot once the item is published, so
           * the row carries whichever one applies — never both. */}
          {isPublishInActionRow && shouldShowUnpublish && (
            <NeutralButton
              label={texts?.unpublishLabel ?? 'Unpublish'}
              iconBefore={
                <IconWorldOff
                  size={DIAL_ICON_SIZE.MD}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              }
              onClick={handleOpenUnpublish}
              onMouseEnter={handlePublishTriggerIntent}
              onFocus={handlePublishTriggerIntent}
            />
          )}
          {isPublishInActionRow && shouldShowPublish && (
            <NeutralButton
              label={texts?.publishLabel ?? 'Publish'}
              iconBefore={
                <IconWorldShare
                  size={DIAL_ICON_SIZE.MD}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              }
              onClick={handleOpenPublish}
              onMouseEnter={handlePublishTriggerIntent}
              onFocus={handlePublishTriggerIntent}
            />
          )}
          {shouldShowCredentialsAction && !isCredentialsActionPrimary && (
            <HeaderCredentialsButton
              buttonComponent={NeutralButton}
              {...credentialsButtonProps}
            />
          )}
          {!isUnpublishPending && (
            <HeaderManageSlot
              item={item}
              promotedManageAction={promotedManageAction}
              manageItems={manageItems}
              onManageOpenChange={handleManageOpenChange}
              onManageTriggerIntent={handleManageTriggerIntent}
              isShareInActionRow={isShareInActionRow}
              shouldShowShareAction={shouldShowShareAction}
              shareOverlay={shareOverlay}
              isShareOverlayOpen={isShareOverlayOpen}
              onShareOverlayOpenChange={setIsShareOverlayOpen}
              onCloseShareOverlay={handleCloseShareOverlay}
              onShare={onShare}
              isShareVisible={isShareVisible}
              texts={texts}
            />
          )}
        </div>
      )}
    </div>
  );
};

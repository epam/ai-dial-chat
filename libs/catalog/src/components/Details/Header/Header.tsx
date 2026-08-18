import {
  CatalogEntityType,
  EntityHeader,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  Dropdown,
  FolderPath,
  NeutralButton,
  NeutralIconButton,
  PrimaryButton,
  Spinner,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconDots,
  IconDownload,
  IconKey,
  IconLogin,
  IconLogout,
  IconPencil,
  IconPlayerPlayFilled,
  IconTrash,
  IconUserOff,
  IconWorldShare,
} from '@tabler/icons-react';
import {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import type {
  ItemDetailsStyles,
  ItemDetailsTexts,
} from '../../../models/item-details-props';
import { RecipientsCountStatus } from '../../../types/recipients-count';
import {
  CredentialsUiState,
  ToolsetAuthenticationType,
  type CredentialsLevel,
} from '../../../types/toolset-auth';
import { getCredentialsUiState } from '../../../utils/toolset-credentials';
import styles from './Header.module.scss';
import { ShareButton } from './ShareButton/ShareButton';

interface HeaderProps {
  item: CatalogItem;
  onUseInChat?: (item: CatalogItem) => void;
  isPrimaryActionVisible?: (item: CatalogItem) => boolean;
  onShare?: (item: CatalogItem) => void;
  /**
   * Renders the Share popover content anchored to the Share button. When
   * provided, clicking Share opens this popover instead of calling `onShare`.
   */
  shareOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode;
  /**
   * Additional caller-supplied rule for whether Share is shown, combined
   * (AND) with the built-in ownership/type rule.
   */
  isShareVisible?: (item: CatalogItem) => boolean;
  onEdit?: (item: CatalogItem) => void;
  /**
   * Called when "Download" is clicked. In the Manage menu, fire-and-forget:
   * the result is not awaited and no pending state is shown. As the primary
   * action (see `isDownloadPrimary`), the call is awaited and drives a
   * pending/disabled state on the button.
   */
  onDownload?: (item: CatalogItem) => Promise<void> | void;
  /** Additional caller-supplied rule for whether "Download" is shown. Defaults to `true` when absent. */
  isDownloadVisible?: (item: CatalogItem) => boolean;
  /**
   * Resolves whether Download renders as the primary action instead of a
   * Manage-menu entry. Defaults to `item.type === CatalogEntityType.Skill`.
   * An item whose Download is primary never also shows it in the Manage menu.
   */
  isDownloadPrimary?: (item: CatalogItem) => boolean;
  /** Called when "Delete" is clicked in the Manage menu. The details panel owns the confirmation step, so this only requests it. */
  onDelete?: (item: CatalogItem) => void;
  /** Called when the recipient-side "Remove from My List" action is clicked for an item shared with the current user. The details panel owns the confirmation step. */
  onUnshare?: (item: CatalogItem) => void;
  /** Additional caller-supplied rule for whether "Remove from My List" is shown, combined (AND) with the built-in `sharedWithMe`/`isMyApp` rule. Defaults to `true` when absent. */
  isUnshareVisible?: (item: CatalogItem) => boolean;
  /** Called when the owner-side "Revoke access" action is clicked for an item the current user owns. The details panel owns the confirmation step. */
  onRevokeShare?: (item: CatalogItem) => void;
  /** Resolves how many users currently hold shared access to an owned item, called when the Manage menu is opened or focused. `0` hides "Revoke access"; `undefined` or a rejection leaves it reachable without a count. */
  onFetchRecipientsCount?: (item: CatalogItem) => Promise<number | undefined>;
  /** Additional caller-supplied rule for whether "Revoke access" is shown, combined (AND) with the built-in `isMyApp` rule and the recipient count. Defaults to `true` when absent. */
  isRevokeShareVisible?: (item: CatalogItem) => boolean;
  onLogin?: (
    item: CatalogItem,
    params: { level: CredentialsLevel; apiKey?: string },
  ) => Promise<void> | void;
  onLogout?: (
    item: CatalogItem,
    params: { level: CredentialsLevel },
  ) => Promise<void> | void;
  /**
   * Called when the credentials trigger button is clicked and the
   * resolved state is "Log in" / "Login with my creds" / "Manage
   * credentials" — toggles the inline credentials section.
   */
  onToggleCredentials?: () => void;
  /**
   * Called instead of `onToggleCredentials` when the resolved state is
   * "Log out" — opens the logout confirmation directly, without expanding
   * the full section first.
   */
  onRequestLogout?: () => void;
  texts?: ItemDetailsTexts;
  detailsStyles?: ItemDetailsStyles;
  /** Controls whether the "Publish" action is shown. Defaults to the same rule as the primary action. */
  isPublishVisible?: (item: CatalogItem) => boolean;
  /** Called when the "Publish" button is clicked; the host swaps this panel's content to the publish view. */
  onOpenPublish?: () => void;
}
/** Details panel header bar: entity identity (icon + name + version), action buttons (primary action, Share, a "Manage" menu for Edit/Publish/Delete), and inline credentials section. For Toolsets, the credentials action (Log in / Log out / manage) renders first and styled as the primary action, since Toolsets have no "Use in chat" action. */
export const Header: FC<HeaderProps> = ({
  item,
  onUseInChat,
  isPrimaryActionVisible,
  onShare,
  shareOverlay,
  isShareVisible,
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
  onToggleCredentials,
  onRequestLogout,
  texts,
  detailsStyles,
  isPublishVisible,
  onOpenPublish,
}) => {
  const {
    nameClassName = 'dial-body-semi-text',
    folderLabelClassName = 'dial-tiny-text',
    folderLeafClassName = 'dial-tiny-semi-text',
  } = detailsStyles?.typography ?? {};

  const handleUseInChat = useCallback(() => {
    onUseInChat?.(item);
  }, [item, onUseInChat]);

  const handleEdit = useCallback(() => {
    onEdit?.(item);
  }, [item, onEdit]);

  const handleOpenPublish = useCallback(() => {
    onOpenPublish?.();
  }, [onOpenPublish]);

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

  const handleUnshare = useCallback(() => {
    onUnshare?.(item);
  }, [item, onUnshare]);

  const handleDelete = useCallback(() => {
    onDelete?.(item);
  }, [item, onDelete]);

  const handleRevokeShare = useCallback(() => {
    onRevokeShare?.(item);
  }, [item, onRevokeShare]);

  const [recipientsCountStatus, setRecipientsCountStatus] = useState(
    RecipientsCountStatus.Idle,
  );
  const [recipientsCount, setRecipientsCount] = useState<number | undefined>(
    undefined,
  );
  /* The item whose lookup has already been started, so hovering and then
   * opening the menu does not issue the same request twice, and a response
   * that arrives after the panel moved on is discarded. */
  const requestedItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    requestedItemIdRef.current = null;
    setRecipientsCountStatus(RecipientsCountStatus.Idle);
    setRecipientsCount(undefined);
  }, [item.id]);

  const requestRecipientsCount = useCallback(() => {
    if (!onFetchRecipientsCount || requestedItemIdRef.current === item.id) {
      return;
    }
    /* Nothing to gate: an item that could never offer the action needs no
     * count, so no request is made for one. */
    if (
      !onRevokeShare ||
      item.isMyApp !== true ||
      isRevokeShareVisible?.(item) === false
    ) {
      return;
    }
    const requestedItemId = item.id;
    requestedItemIdRef.current = requestedItemId;
    setRecipientsCountStatus(RecipientsCountStatus.Loading);

    const resolve = async () => {
      try {
        const count = await onFetchRecipientsCount(item);
        if (requestedItemIdRef.current !== requestedItemId) return;
        setRecipientsCount(count);
        setRecipientsCountStatus(
          count == null
            ? RecipientsCountStatus.Unknown
            : RecipientsCountStatus.Resolved,
        );
      } catch {
        /* An unresolved count must not remove the only way to revoke, so the
         * action stays reachable — just without a number. */
        if (requestedItemIdRef.current !== requestedItemId) return;
        setRecipientsCount(undefined);
        setRecipientsCountStatus(RecipientsCountStatus.Unknown);
      }
    };
    void resolve();
  }, [item, onFetchRecipientsCount, onRevokeShare, isRevokeShareVisible]);

  const handleManageOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) requestRecipientsCount();
    },
    [requestRecipientsCount],
  );

  const shouldShowPrimaryAction =
    texts?.hasPrimaryAction !== false &&
    (isPrimaryActionVisible?.(item) ??
      (item.type === CatalogEntityType.Model ||
        item.type === CatalogEntityType.Agent ||
        item.type === CatalogEntityType.Prompt));

  const shouldShowPublish =
    isPublishVisible?.(item) ??
    (item.type === CatalogEntityType.Model ||
      item.type === CatalogEntityType.Toolset ||
      item.type === CatalogEntityType.Agent);

  const shouldShowEditAction = !!onEdit && !!item.isEditable;

  const credentialsUiState =
    item.credentials != null &&
    item.credentials.authenticationType !== ToolsetAuthenticationType.None
      ? getCredentialsUiState(item.credentials)
      : undefined;
  const shouldShowCredentialsAction =
    credentialsUiState != null && (!!onLogin || !!onLogout);
  /* Toolsets have no "Use in chat" primary action, so the credentials
   * button (Log in / Log out / manage) takes over as their primary,
   * leading action instead. */
  const isCredentialsActionPrimary =
    item.type === CatalogEntityType.Toolset && shouldShowCredentialsAction;

  const isDownloadActionEnabled =
    !!onDownload && (isDownloadVisible?.(item) ?? true);
  /* Credentials, where active, always keeps the primary slot ahead of Download. */
  const isDownloadActionPrimary =
    isDownloadActionEnabled &&
    !isCredentialsActionPrimary &&
    (isDownloadPrimary?.(item) ?? item.type === CatalogEntityType.Skill);
  /* A promoted Download renders in the primary slot only — never duplicated in the Manage menu. */
  const shouldShowDownloadAction =
    isDownloadActionEnabled && !isDownloadActionPrimary;
  const shouldShowDeleteAction = item.isMyApp;
  /*
   * The recipient-side "Remove from My List" action is the counterpart of
   * Delete: it discards only the current user's own access, so it shows
   * exclusively for items shared with them. `isMyApp` and `sharedWithMe` are
   * mutually exclusive for a given item, so Delete and this action never
   * render at the same time.
   */
  const shouldShowUnshareAction =
    !!onUnshare &&
    item.isMyApp !== true &&
    item.sharedWithMe === true &&
    (isUnshareVisible?.(item) ?? true);
  /*
   * The owner-side counterpart: revoking removes *other people's* access to
   * an item the caller owns, so it renders alongside Delete and never with
   * "Remove from My List". It also stays hidden while nobody holds access —
   * an action that would be a no-op is noise.
   *
   * The count is resolved when this menu opens rather than carried on the
   * item, so it is never a stale snapshot from a list fetch (revoking once
   * would otherwise leave the action offering to revoke again). Until it
   * settles the entry is withheld; a lookup that cannot produce a number
   * still shows it, so a transient failure never removes the only way to
   * revoke.
   */
  const shouldShowRevokeShareAction =
    !!onRevokeShare &&
    item.isMyApp === true &&
    (!onFetchRecipientsCount ||
      recipientsCountStatus === RecipientsCountStatus.Unknown ||
      (recipientsCountStatus === RecipientsCountStatus.Resolved &&
        (recipientsCount ?? 0) > 0)) &&
    (isRevokeShareVisible?.(item) ?? true);

  const manageItems = useMemo<DropdownItem[]>(() => {
    const items: DropdownItem[] = [];
    if (shouldShowEditAction) {
      items.push({
        key: 'edit',
        label: texts?.editActionLabel ?? 'Edit',
        icon: (
          <IconPencil
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            className="text-secondary"
          />
        ),
        onClick: handleEdit,
      });
    }
    if (shouldShowDownloadAction) {
      items.push({
        key: 'download',
        label: texts?.downloadActionLabel ?? 'Download',
        icon: (
          <IconDownload
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            className="text-secondary"
          />
        ),
        onClick: handleDownload,
      });
    }
    if (shouldShowPublish) {
      items.push({
        key: 'publish',
        label: texts?.publishLabel ?? 'Publish',
        icon: (
          <IconWorldShare
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            className="text-secondary"
          />
        ),
        onClick: handleOpenPublish,
      });
    }
    if (shouldShowDeleteAction) {
      items.push({
        key: 'delete',
        label: texts?.deleteActionLabel ?? 'Delete',
        icon: <IconTrash size={DIAL_ICON_SIZE.SM} aria-hidden />,
        danger: true,
        onClick: handleDelete,
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
        icon: <IconUserOff size={DIAL_ICON_SIZE.SM} aria-hidden />,
        danger: true,
        onClick: handleRevokeShare,
      });
    }
    if (shouldShowUnshareAction) {
      items.push({
        key: 'unshare',
        label: texts?.unshareLabel ?? 'Remove from My List',
        icon: (
          <IconTrash
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            className="text-error"
          />
        ),
        className: 'text-error',
        onClick: handleUnshare,
      });
    }
    return items;
  }, [
    shouldShowEditAction,
    shouldShowDownloadAction,
    shouldShowPublish,
    shouldShowDeleteAction,
    shouldShowRevokeShareAction,
    recipientsCount,
    shouldShowUnshareAction,
    texts,
    handleEdit,
    handleDownload,
    handleOpenPublish,
    handleDelete,
    handleRevokeShare,
    handleUnshare,
  ]);

  const handleCredentialsClick = useCallback(() => {
    if (credentialsUiState === CredentialsUiState.LogOut) {
      onRequestLogout?.();
    } else {
      onToggleCredentials?.();
    }
  }, [credentialsUiState, onRequestLogout, onToggleCredentials]);

  const credentialsLabel = {
    [CredentialsUiState.ManageCredentials]:
      texts?.manageCredentialsActionLabel ?? 'Manage credentials',
    [CredentialsUiState.LoginWithMyCreds]:
      texts?.loginWithMyCredsActionLabel ?? 'Login with my creds',
    [CredentialsUiState.LogIn]: texts?.loginActionLabel ?? 'Log in',
    [CredentialsUiState.LogOut]: texts?.logoutActionLabel ?? 'Log out',
  }[credentialsUiState ?? CredentialsUiState.LogIn];

  const credentialsIcon = {
    [CredentialsUiState.ManageCredentials]: (
      <IconKey size={DIAL_ICON_SIZE.MD} />
    ),
    [CredentialsUiState.LoginWithMyCreds]: (
      <IconLogin size={DIAL_ICON_SIZE.MD} />
    ),
    [CredentialsUiState.LogIn]: <IconLogin size={DIAL_ICON_SIZE.MD} />,
    [CredentialsUiState.LogOut]: <IconLogout size={DIAL_ICON_SIZE.MD} />,
  }[credentialsUiState ?? CredentialsUiState.LogIn];

  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      <EntityHeader
        item={item}
        iconSize={52}
        nameClassName={mergeClasses(nameClassName, styles.name)}
        featuredLabel={texts?.featuredLabel ?? 'Featured'}
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
      <div className="flex flex-wrap items-center gap-2 ps-[60px]">
        {isCredentialsActionPrimary && (
          <PrimaryButton
            label={credentialsLabel}
            iconBefore={credentialsIcon}
            onClick={handleCredentialsClick}
          />
        )}
        {shouldShowPrimaryAction && (
          <PrimaryButton
            label={texts?.primaryActionLabel ?? 'Use in chat'}
            iconBefore={<IconPlayerPlayFilled size={DIAL_ICON_SIZE.MD} />}
            onClick={handleUseInChat}
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
                  <IconDownload size={DIAL_ICON_SIZE.MD} aria-hidden />
                )
              }
              onClick={handleDownloadPrimary}
              disabled={isDownloading}
              aria-busy={isDownloading}
            />
            {isDownloading && (
              <span role="status" aria-live="polite" className="sr-only">
                {texts?.downloadingStatusLabel ?? 'Downloading'}
              </span>
            )}
          </>
        )}
        <ShareButton
          item={item}
          onShare={onShare}
          shareOverlay={shareOverlay}
          isShareVisible={isShareVisible}
          label={texts?.shareLabel}
        />
        {shouldShowCredentialsAction && !isCredentialsActionPrimary && (
          <NeutralButton
            label={credentialsLabel}
            iconBefore={credentialsIcon}
            onClick={handleCredentialsClick}
          />
        )}
        {manageItems.length > 0 && (
          <Dropdown
            items={manageItems}
            placement="bottom-end"
            matchReferenceWidth={false}
            onOpenChange={handleManageOpenChange}
          >
            {/* Hover and focus start the recipient-count lookup before the
             * click lands, so the "Revoke access" entry is usually already
             * settled by the time the menu opens. */}
            <NeutralIconButton
              icon={<IconDots size={DIAL_ICON_SIZE.MD} aria-hidden />}
              aria-label={texts?.manageActionLabel ?? 'Manage'}
              aria-haspopup="menu"
              onMouseEnter={requestRecipientsCount}
              onFocus={requestRecipientsCount}
            />
          </Dropdown>
        )}
      </div>
    </div>
  );
};

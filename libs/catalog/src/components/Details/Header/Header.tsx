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
  IconArrowRight,
  IconChevronDown,
  IconDots,
  IconDownload,
  IconKey,
  IconLogin,
  IconLogout,
  IconPencil,
  IconPlayerPlayFilled,
  IconShare,
  IconTrash,
  IconUserOff,
  IconWorldOff,
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
import { CatalogLimitStatus } from '../../../models/item-details-data';
import type {
  ItemDetailsStyles,
  ItemDetailsTexts,
} from '../../../models/item-details-props';
import { RecipientsCountStatus } from '../../../types/recipients-count';
import {
  CredentialsLevel,
  CredentialsUiState,
  ToolsetAuthenticationType,
} from '../../../types/toolset-auth';
import { getCredentialsUiState } from '../../../utils/toolset-credentials';
import { CredentialsApiKeyOverlay } from './CredentialsApiKeyOverlay/CredentialsApiKeyOverlay';
import styles from './Header.module.scss';
import { ShareButton } from './ShareButton/ShareButton';

const defaultManageCredentialsActionLabel = (
  authenticationType: ToolsetAuthenticationType,
): string =>
  authenticationType === ToolsetAuthenticationType.ApiKey
    ? 'Manage API keys'
    : 'Manage credentials';

const LIMIT_STATUS_CLASSES: Record<CatalogLimitStatus, string> = {
  [CatalogLimitStatus.LimitReached]: 'bg-error text-error',
  [CatalogLimitStatus.RunningLow]: 'bg-warning text-warning',
};

interface LimitStatusBadgeProps {
  status: CatalogLimitStatus;
  label: string;
}

/** Small status pill matching `FeaturedChip`'s shape, shown in the same header corner. */
const LimitStatusBadge: FC<LimitStatusBadgeProps> = ({ status, label }) => (
  <div
    className={mergeClasses(
      'flex h-[24px] items-center justify-center gap-1 whitespace-nowrap rounded-2xl px-2',
      'dial-caption-lead-semi-text',
      LIMIT_STATUS_CLASSES[status],
    )}
  >
    {label}
  </div>
);

interface HeaderProps {
  item: CatalogItem;
  onUseInChat?: (item: CatalogItem) => void;
  isPrimaryActionVisible?: (item: CatalogItem) => boolean;
  onShare?: (item: CatalogItem) => void;
  /**
   * Renders the Share popover content. When provided, choosing Share opens
   * this popover instead of calling `onShare`. It anchors to whichever surface
   * carries Share: the header button, or the Manage trigger when
   * `isSharePrimary` has moved the entry into that menu.
   */
  shareOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode;
  /**
   * Additional caller-supplied rule for whether Share is shown, combined
   * (AND) with the built-in ownership/type rule.
   */
  isShareVisible?: (item: CatalogItem) => boolean;
  /**
   * Resolves whether Share renders as its own header button rather than a
   * Manage-menu entry. Defaults to `true` — the header button. Returning
   * `false` moves Share into the Manage menu, beside Delete. Share renders on
   * one surface or the other, never both.
   */
  isSharePrimary?: (item: CatalogItem) => boolean;
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
   * Called when the credentials trigger button is clicked and the resolved
   * state is "Manage credentials"/"Manage API keys" — opens the admin
   * credentials-management sub-screen.
   */
  onOpenCredentialsManagement?: () => void;
  /**
   * Called instead of directly logging out when the resolved state is
   * "Log out" for OAuth authentication — opens the logout confirmation
   * without signing out immediately.
   */
  onRequestLogout?: () => void;
  texts?: ItemDetailsTexts;
  detailsStyles?: ItemDetailsStyles;
  /**
   * Controls whether the "Publish" action is shown. Defaults to the same rule
   * as the primary action. Returning `true` is not sufficient on its own:
   * "Publish" is suppressed whenever "Unpublish" is shown, so the panel
   * carries one of the two, never both.
   */
  isPublishVisible?: (item: CatalogItem) => boolean;
  /**
   * Resolves whether whichever of "Publish"/"Unpublish" applies renders as its
   * own header button rather than a Manage-menu entry. Defaults to `false` —
   * the menu entry. It renders on one surface or the other, never both.
   */
  isPublishPrimary?: (item: CatalogItem) => boolean;
  /** Called when the "Publish" button is clicked; the host swaps this panel's content to the publish view. */
  onOpenPublish?: () => void;
  /**
   * Additional caller-supplied rule for whether "Unpublish" is shown,
   * combined (AND) with `hasPublishedFolders` and the presence of
   * `onOpenUnpublish`. Defaults to `true` when absent. When the entry ends up
   * shown, it replaces "Publish" rather than joining it.
   */
  isUnpublishVisible?: (item: CatalogItem) => boolean;
  /**
   * Whether the panel has resolved publish history for this item to at least
   * one folder. Withheld while the lookup is unresolved and `false` on zero
   * entries or failure — the request cannot be built without a folder, so an
   * entry shown without one could not do anything if clicked. Default: `false`.
   */
  hasPublishedFolders?: boolean;
  /**
   * Starts the panel's publish-history lookup, called on hover/focus of the
   * Manage trigger and on Manage-menu open, plus on hover/focus of the publish
   * button where `isPublishPrimary` promoted it into the action row. Guarded
   * once per item by the panel.
   */
  onRequestPublishHistory?: () => void;
  /** Called when the "Unpublish" button is clicked; the host swaps this panel's content to the unpublish confirmation. */
  onOpenUnpublish?: () => void;
  /**
   * Renders the header read-only: every action that mutates the item or the
   * caller's relationship to it — Share, Publish/Unpublish, Edit, Delete,
   * "Remove from My List", "Revoke access", and the credentials Log in / Log
   * out / manage button — is withheld. The non-mutating actions (the primary
   * "Use in chat" and Download) still render. Default: false.
   */
  isReadonly?: boolean;
}
/** Details panel header bar: entity identity (icon + name + version), action buttons (primary action, Share, a "Manage" menu for Edit, Publish or Unpublish, and Delete), and inline credentials section. For Toolsets, the credentials action (Log in / Log out / manage) renders first and styled as the primary action, since Toolsets have no "Use in chat" action. Shows a "Running low"/"Limit reached" badge from `item.details?.limits?.status`, disabling "Use in chat" once a limit is reached. */
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
  onRequestPublishHistory,
  onOpenUnpublish,
  isReadonly = false,
}) => {
  const {
    nameClassName = 'dial-body-semi-text',
    folderLabelClassName = 'dial-tiny-text',
    folderLeafClassName = 'dial-tiny-semi-text',
  } = detailsStyles?.typography ?? {};

  const limitStatus = item.details?.limits?.status;
  const statusBadge =
    limitStatus != null ? (
      <LimitStatusBadge
        status={limitStatus}
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

  const shouldShowPrimaryAction =
    texts?.hasPrimaryAction !== false &&
    (isPrimaryActionVisible?.(item) ??
      (item.type === CatalogEntityType.Model ||
        item.type === CatalogEntityType.Agent ||
        item.type === CatalogEntityType.Prompt));

  /*
   * Gated on resolved history rather than staying reachable the way "Revoke
   * access" does on an unresolved count: revoke needs the lookup only for a
   * number in its label, while unpublish needs the folder itself to build the
   * request, so an entry shown without one could not do anything if clicked.
   */
  const shouldShowUnpublish =
    !isReadonly &&
    !!onOpenUnpublish &&
    hasPublishedFolders &&
    (isUnpublishVisible?.(item) ?? true);

  /*
   * "Publish" and "Unpublish" are mutually exclusive: the panel offers
   * whichever one matches the item's current state, never both at once. An
   * item with no published copy offers "Publish"; once history resolves to at
   * least one published folder, "Unpublish" takes its place.
   *
   * This does hide a second publish of an already-published item (to another
   * folder, or a re-publish of the same one). That is the trade the
   * single-state action buys, and republishing stays reachable by unpublishing
   * first.
   *
   * Because the history lookup is lazy (see `handleManageTriggerIntent` and
   * `handlePublishTriggerIntent`), it can start as "Publish" and become
   * "Unpublish" once the response arrives — which is why the lookup is fired
   * on hover/focus of the trigger rather than on click, so it is usually
   * settled before the action becomes visible.
   */
  const shouldShowPublish =
    !isReadonly &&
    !shouldShowUnpublish &&
    (isPublishVisible?.(item) ??
      (item.type === CatalogEntityType.Model ||
        item.type === CatalogEntityType.Toolset ||
        item.type === CatalogEntityType.Agent));

  const shouldShowEditAction = !isReadonly && !!onEdit && !!item.isEditable;

  /*
   * Sharing is limited to entities the current user owns (deployments and
   * toolsets in their personal space), not the whole catalog — anything else
   * would offer an entry with no defined behavior. `ShareButton` applies the
   * same rule itself, so this only gates the Manage-menu arrangement.
   */
  const shouldShowShareAction =
    !isReadonly && item.isMyApp === true && (isShareVisible?.(item) ?? true);

  /*
   * Which surface each of Share and Publish lands on. The defaults are the
   * historical arrangement — Share as its own button in the action row,
   * Publish inside the Manage menu — and a host that wants the reverse flips
   * one or both. Each action renders on exactly one of the two surfaces.
   */
  const isShareInActionRow = isSharePrimary?.(item) ?? true;
  const isPublishInActionRow = isPublishPrimary?.(item) ?? false;

  const authenticationType =
    item.credentials?.authenticationType ?? ToolsetAuthenticationType.None;
  const credentialsUiState =
    item.credentials != null &&
    authenticationType !== ToolsetAuthenticationType.None
      ? getCredentialsUiState(item.credentials)
      : undefined;
  const shouldShowCredentialsAction =
    !isReadonly && credentialsUiState != null && (!!onLogin || !!onLogout);
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
  const shouldShowDeleteAction = !isReadonly && item.isMyApp;
  /*
   * The recipient-side "Remove from My List" action is the counterpart of
   * Delete: it discards only the current user's own access, so it shows
   * exclusively for items shared with them. `isMyApp` and `sharedWithMe` are
   * mutually exclusive for a given item, so Delete and this action never
   * render at the same time.
   */
  const shouldShowUnshareAction =
    !isReadonly &&
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
    !isReadonly &&
    !!onRevokeShare &&
    item.isMyApp === true &&
    (!onFetchRecipientsCount ||
      recipientsCountStatus === RecipientsCountStatus.Unknown ||
      (recipientsCountStatus === RecipientsCountStatus.Resolved &&
        (recipientsCount ?? 0) > 0)) &&
    (isRevokeShareVisible?.(item) ?? true);

  const manageItems = useMemo<DropdownItem[]>(() => {
    const items: DropdownItem[] = [];
    if (!isShareInActionRow && shouldShowShareAction) {
      items.push({
        key: 'share',
        label: texts?.shareLabel ?? 'Share',
        icon: (
          <IconShare
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            className="text-secondary"
          />
        ),
        onClick: handleShare,
      });
    }
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
    if (!isPublishInActionRow && shouldShowPublish) {
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
    if (!isPublishInActionRow && shouldShowUnpublish) {
      /* Not `danger`: unpublishing removes a published copy but destroys
       * nothing the owner holds — the source item is untouched and can be
       * published again — so it sits with Edit/Download/Publish. */
      items.push({
        key: 'unpublish',
        label: texts?.unpublishLabel ?? 'Unpublish',
        icon: (
          <IconWorldOff
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            className="text-secondary"
          />
        ),
        onClick: handleOpenUnpublish,
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
        icon: <IconTrash size={DIAL_ICON_SIZE.SM} aria-hidden />,

        onClick: handleUnshare,
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

  const [isApiKeyOverlayOpen, setIsApiKeyOverlayOpen] = useState(false);

  /* API-key auth resolves to a popover trigger for every state except the
   * admin's "Manage API keys", which opens the dedicated sub-screen. */
  const isApiKeyOverlayTrigger =
    authenticationType === ToolsetAuthenticationType.ApiKey &&
    credentialsUiState !== CredentialsUiState.ManageCredentials;
  /* Once a personal API key is on file, the trigger drops from the
   * call-to-action (primary) look to the same low-emphasis style as Share —
   * matching the design's "Change API key" state. */
  const isApiKeyConfigured =
    authenticationType === ToolsetAuthenticationType.ApiKey &&
    credentialsUiState === CredentialsUiState.LogOut;
  const isOAuthLoginLogoutButton =
    authenticationType !== ToolsetAuthenticationType.ApiKey &&
    credentialsUiState !== CredentialsUiState.ManageCredentials;
  const isOAuthLogoutState =
    isOAuthLoginLogoutButton &&
    credentialsUiState === CredentialsUiState.LogOut;

  const handleCredentialsClick = useCallback(() => {
    if (credentialsUiState === CredentialsUiState.ManageCredentials) {
      onOpenCredentialsManagement?.();
      return;
    }
    if (isApiKeyOverlayTrigger) {
      setIsApiKeyOverlayOpen((prev) => !prev);
      return;
    }
    if (credentialsUiState === CredentialsUiState.LogOut) {
      onRequestLogout?.();
      return;
    }
    /* OAuth "Log in" always applies to the current user's own credentials —
     * there is no admin/global concept here since this branch only runs for
     * the non-admin states. The org-fallback nudge is conveyed by the banner
     * below the header, not by the button's wording. */
    onLogin?.(item, { level: CredentialsLevel.User });
  }, [
    credentialsUiState,
    isApiKeyOverlayTrigger,
    item,
    onLogin,
    onOpenCredentialsManagement,
    onRequestLogout,
  ]);

  const credentialsLabel = (() => {
    if (credentialsUiState === CredentialsUiState.ManageCredentials) {
      return (
        texts?.manageCredentialsActionLabel ??
        defaultManageCredentialsActionLabel
      )(authenticationType);
    }
    if (authenticationType === ToolsetAuthenticationType.ApiKey) {
      return credentialsUiState === CredentialsUiState.LogOut
        ? (texts?.changeApiKeyActionLabel ?? 'Change API key')
        : (texts?.apiKeyActionLabel ?? 'API key');
    }
    return credentialsUiState === CredentialsUiState.LogOut
      ? (texts?.logoutActionLabel ?? 'Log out')
      : (texts?.loginActionLabel ?? 'Log in');
  })();

  const credentialsIconBefore = (() => {
    if (credentialsUiState === CredentialsUiState.ManageCredentials) {
      return <IconKey size={DIAL_ICON_SIZE.MD} />;
    }
    if (authenticationType === ToolsetAuthenticationType.ApiKey) {
      return <IconKey size={DIAL_ICON_SIZE.MD} />;
    }
    return credentialsUiState === CredentialsUiState.LogOut ? (
      <IconLogout size={DIAL_ICON_SIZE.MD} />
    ) : (
      <IconLogin size={DIAL_ICON_SIZE.MD} />
    );
  })();

  const credentialsIconAfter =
    credentialsUiState === CredentialsUiState.ManageCredentials ? (
      <IconArrowRight size={DIAL_ICON_SIZE.MD} className="rtl:scale-x-[-1]" />
    ) : isApiKeyOverlayTrigger ? (
      <IconChevronDown size={DIAL_ICON_SIZE.MD} />
    ) : undefined;

  const renderCredentialsButton = (
    ButtonComponent: typeof PrimaryButton | typeof NeutralButton,
  ) => {
    const button = (
      <ButtonComponent
        label={credentialsLabel}
        iconBefore={credentialsIconBefore}
        iconAfter={credentialsIconAfter}
        onClick={handleCredentialsClick}
        aria-haspopup={isApiKeyOverlayTrigger ? 'dialog' : undefined}
        aria-expanded={isApiKeyOverlayTrigger ? isApiKeyOverlayOpen : undefined}
      />
    );
    if (!isApiKeyOverlayTrigger || item.credentials == null) {
      return button;
    }
    return (
      <Dropdown
        placement="bottom-start"
        matchReferenceWidth={false}
        open={isApiKeyOverlayOpen}
        onOpenChange={setIsApiKeyOverlayOpen}
        trigger={[]}
        outsideClosable
        renderOverlay={() => (
          <CredentialsApiKeyOverlay
            item={item}
            level={CredentialsLevel.User}
            status={item.credentials?.userStatus}
            apiKeyAddedWhen={item.credentials?.userApiKeyAddedWhen}
            onLogin={onLogin}
            onLogout={onLogout}
            onClose={() => setIsApiKeyOverlayOpen(false)}
            texts={texts}
          />
        )}
      >
        {button}
      </Dropdown>
    );
  };

  const renderManageMenu = (): ReactNode => {
    const menu = (
      <Dropdown
        items={manageItems}
        placement="bottom-end"
        matchReferenceWidth={false}
        onOpenChange={handleManageOpenChange}
      >
        {/* Hover and focus start the recipient-count and publish-history
         * lookups before the click lands, so the "Revoke access" entry — and
         * the publish button's own state — are usually already settled by the
         * time the menu opens. */}
        <NeutralIconButton
          icon={<IconDots size={DIAL_ICON_SIZE.LG} aria-hidden />}
          aria-label={texts?.manageActionLabel ?? 'Manage'}
          aria-haspopup="menu"
          onMouseEnter={handleManageTriggerIntent}
          onFocus={handleManageTriggerIntent}
        />
      </Dropdown>
    );
    if (isShareInActionRow || !shareOverlay || !shouldShowShareAction) {
      return menu;
    }
    /* With Share inside the menu, its popover is anchored to this trigger
     * instead: the entry that opens it is unmounted by the time the popover
     * appears, so it has no node of its own to hang from. */
    return (
      <Dropdown
        placement="bottom-end"
        matchReferenceWidth={false}
        open={isShareOverlayOpen}
        onOpenChange={setIsShareOverlayOpen}
        trigger={[]}
        outsideClosable
        renderOverlay={() => shareOverlay(item, handleCloseShareOverlay)}
      >
        {menu}
      </Dropdown>
    );
  };

  return (
    <div className="flex flex-col gap-3 px-6 py-4">
      <EntityHeader
        item={item}
        iconSize={52}
        nameClassName={mergeClasses(nameClassName, styles.name)}
        featuredLabel={texts?.featuredLabel ?? 'Featured'}
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
      <div className="flex flex-wrap items-center gap-2 ps-[60px]">
        {isCredentialsActionPrimary &&
          renderCredentialsButton(
            isApiKeyConfigured || isOAuthLogoutState
              ? NeutralButton
              : PrimaryButton,
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
            iconBefore={<IconWorldOff size={DIAL_ICON_SIZE.MD} aria-hidden />}
            onClick={handleOpenUnpublish}
            onMouseEnter={handlePublishTriggerIntent}
            onFocus={handlePublishTriggerIntent}
          />
        )}
        {isPublishInActionRow && shouldShowPublish && (
          <NeutralButton
            label={texts?.publishLabel ?? 'Publish'}
            iconBefore={<IconWorldShare size={DIAL_ICON_SIZE.MD} aria-hidden />}
            onClick={handleOpenPublish}
            onMouseEnter={handlePublishTriggerIntent}
            onFocus={handlePublishTriggerIntent}
          />
        )}
        {shouldShowCredentialsAction &&
          !isCredentialsActionPrimary &&
          renderCredentialsButton(NeutralButton)}
        {manageItems.length > 0 && renderManageMenu()}
      </div>
    </div>
  );
};

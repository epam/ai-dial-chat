import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DangerButton,
  DIAL_ICON_SIZE,
  Dropdown,
  FolderPath,
  NeutralButton,
  NeutralIconButton,
  PrimaryButton,
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
import { CatalogEntityType } from '../../../types/entity-type';
import { RecipientsCountStatus } from '../../../types/recipients-count';
import {
  CredentialsLevel,
  CredentialsUiState,
  ToolsetAuthenticationType,
} from '../../../types/toolset-auth';
import { getCredentialsUiState } from '../../../utils/toolset-credentials';
import { EntityHeader } from '../../EntityHeader/EntityHeader';
import { CredentialsApiKeyOverlay } from './CredentialsApiKeyOverlay/CredentialsApiKeyOverlay';
import styles from './Header.module.scss';
import { ShareButton } from './ShareButton/ShareButton';

const defaultManageCredentialsActionLabel = (
  authenticationType: ToolsetAuthenticationType,
): string =>
  authenticationType === ToolsetAuthenticationType.ApiKey
    ? 'Manage API keys'
    : 'Manage credentials';

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
  /** Called when "Download" is clicked in the Manage menu. Fire-and-forget: the result is not awaited and no pending state is shown. */
  onDownload?: (item: CatalogItem) => Promise<void> | void;
  /** Additional caller-supplied rule for whether "Download" is shown. Defaults to `true` when absent. */
  isDownloadVisible?: (item: CatalogItem) => boolean;
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
  const shouldShowDownloadAction =
    !!onDownload && (isDownloadVisible?.(item) ?? true);
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

  const [isApiKeyOverlayOpen, setIsApiKeyOverlayOpen] = useState(false);

  const authenticationType =
    item.credentials?.authenticationType ?? ToolsetAuthenticationType.None;
  const credentialsUiState =
    item.credentials != null &&
    authenticationType !== ToolsetAuthenticationType.None
      ? getCredentialsUiState(item.credentials)
      : undefined;
  const shouldShowCredentialsAction =
    credentialsUiState != null && (!!onLogin || !!onLogout);
  /* Toolsets have no "Use in chat" primary action, so the credentials
   * button (Log in / Log out / manage) takes over as their primary,
   * leading action instead. */
  const isCredentialsActionPrimary =
    item.type === CatalogEntityType.Toolset && shouldShowCredentialsAction;
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
  /* Only the OAuth Log in/Log out toggle needs a fixed width and a danger
   * treatment when signed in — "Manage credentials"/"API key" wording is
   * variable-length by design and keeps its normal styling. */
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
    ButtonComponent:
      | typeof PrimaryButton
      | typeof NeutralButton
      | typeof DangerButton,
  ) => {
    const button = (
      <ButtonComponent
        label={credentialsLabel}
        iconBefore={credentialsIconBefore}
        iconAfter={credentialsIconAfter}
        onClick={handleCredentialsClick}
        aria-haspopup={isApiKeyOverlayTrigger ? 'dialog' : undefined}
        aria-expanded={isApiKeyOverlayTrigger ? isApiKeyOverlayOpen : undefined}
        className={isOAuthLoginLogoutButton ? 'w-28 justify-center' : undefined}
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
        {isCredentialsActionPrimary &&
          renderCredentialsButton(
            (() => {
              if (isApiKeyConfigured) return NeutralButton;
              if (isOAuthLogoutState) return DangerButton;
              return PrimaryButton;
            })(),
          )}
        {shouldShowPrimaryAction && (
          <PrimaryButton
            label={texts?.primaryActionLabel ?? 'Use in chat'}
            iconBefore={<IconPlayerPlayFilled size={DIAL_ICON_SIZE.MD} />}
            onClick={handleUseInChat}
          />
        )}
        <ShareButton
          item={item}
          onShare={onShare}
          shareOverlay={shareOverlay}
          isShareVisible={isShareVisible}
          label={texts?.shareLabel}
        />
        {shouldShowCredentialsAction &&
          !isCredentialsActionPrimary &&
          renderCredentialsButton(
            isOAuthLogoutState ? DangerButton : NeutralButton,
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

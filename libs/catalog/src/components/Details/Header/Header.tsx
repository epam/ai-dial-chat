import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  Dropdown,
  FolderPath,
  NeutralButton,
  NeutralIconButton,
  PrimaryButton,
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
import { FC, useCallback, useMemo, type ReactNode } from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import type {
  ItemDetailsStyles,
  ItemDetailsTexts,
} from '../../../models/item-details-props';
import { CatalogEntityType } from '../../../types/entity-type';
import {
  CredentialsUiState,
  ToolsetAuthenticationType,
  type CredentialsLevel,
} from '../../../types/toolset-auth';
import { getCredentialsUiState } from '../../../utils/toolset-credentials';
import { EntityHeader } from '../../EntityHeader/EntityHeader';
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
  /** Additional caller-supplied rule for whether "Revoke access" is shown, combined (AND) with the built-in `isMyApp`/`recipientsCount` rule. Defaults to `true` when absent. */
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
  onDelete,
  onUnshare,
  isUnshareVisible,
  onRevokeShare,
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

  const handleUnshare = useCallback(() => {
    onUnshare?.(item);
  }, [item, onUnshare]);

  const handleDelete = useCallback(() => {
    onDelete?.(item);
  }, [item, onDelete]);

  const handleRevokeShare = useCallback(() => {
    onRevokeShare?.(item);
  }, [item, onRevokeShare]);

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
   * an action that would be a no-op is noise. `undefined` (host could not
   * determine the count) keeps the action visible rather than silently
   * removing the only way to revoke.
   */
  const recipientsCount = item.recipientsCount;
  const shouldShowRevokeShareAction =
    !!onRevokeShare &&
    item.isMyApp === true &&
    (recipientsCount == null || recipientsCount > 0) &&
    (isRevokeShareVisible?.(item) ?? true);

  const manageItems = useMemo<DropdownItem[]>(() => {
    const items: DropdownItem[] = [];
    if (shouldShowEditAction) {
      items.push({
        key: 'edit',
        label: texts?.editActionLabel ?? 'Edit',
        icon: <IconPencil size={DIAL_ICON_SIZE.SM} aria-hidden />,
        onClick: handleEdit,
      });
    }
    if (shouldShowDownloadAction) {
      items.push({
        key: 'download',
        label: texts?.downloadActionLabel ?? 'Download',
        icon: <IconDownload size={DIAL_ICON_SIZE.SM} aria-hidden />,
        onClick: handleDownload,
      });
    }
    if (shouldShowPublish) {
      items.push({
        key: 'publish',
        label: texts?.publishLabel ?? 'Publish',
        icon: <IconWorldShare size={DIAL_ICON_SIZE.SM} aria-hidden />,
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
          >
            <NeutralIconButton
              icon={<IconDots size={DIAL_ICON_SIZE.MD} aria-hidden />}
              aria-label={texts?.manageActionLabel ?? 'Manage'}
              aria-haspopup="menu"
            />
          </Dropdown>
        )}
      </div>
    </div>
  );
};

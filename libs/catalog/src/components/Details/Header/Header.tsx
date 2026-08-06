import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialSpinner,
  FolderPath,
  NeutralButton,
  NeutralIconButton,
  PrimaryButton,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconDots,
  IconKey,
  IconLogin,
  IconLogout,
  IconPencil,
  IconPlayerPlayFilled,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { FC, useCallback, useMemo, useState, type ReactNode } from 'react';
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
  onDelete?: (item: CatalogItem) => Promise<void> | void;
  /** Called after a delete confirmed via the Manage menu succeeds, to close the whole details panel. */
  onCloseDetails?: () => void;
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
  onDelete,
  onCloseDetails,
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

  const [isDeleting, setIsDeleting] = useState(false);

  const handleUseInChat = useCallback(() => {
    onUseInChat?.(item);
  }, [item, onUseInChat]);

  const handleEdit = useCallback(() => {
    onEdit?.(item);
  }, [item, onEdit]);

  const handleOpenPublish = useCallback(() => {
    onOpenPublish?.();
  }, [onOpenPublish]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDelete?.(item);
      onCloseDetails?.();
    } catch {
      // Failure feedback (e.g. a notification) is the caller's responsibility.
    } finally {
      setIsDeleting(false);
    }
  }, [item, onDelete, onCloseDetails]);

  const shouldShowPrimaryAction =
    texts?.hasPrimaryAction !== false &&
    (isPrimaryActionVisible?.(item) ??
      (item.type === CatalogEntityType.Model ||
        item.type === CatalogEntityType.Agent));

  const shouldShowPublish =
    isPublishVisible?.(item) ??
    (item.type === CatalogEntityType.Model ||
      item.type === CatalogEntityType.Toolset ||
      item.type === CatalogEntityType.Agent);

  const shouldShowEditAction = !!onEdit && !!item.isEditable;
  const shouldShowDeleteAction = item.isMyApp;

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
    if (shouldShowPublish) {
      items.push({
        key: 'publish',
        label: texts?.publishLabel ?? 'Publish',
        icon: <IconUpload size={DIAL_ICON_SIZE.SM} aria-hidden />,
        onClick: handleOpenPublish,
      });
    }
    if (shouldShowDeleteAction) {
      items.push({
        key: 'delete',
        label: texts?.deleteActionLabel ?? 'Delete',
        icon: isDeleting ? (
          <span aria-hidden="true">
            <DialSpinner size={DIAL_ICON_SIZE.SM} />
          </span>
        ) : (
          <IconTrash size={DIAL_ICON_SIZE.SM} aria-hidden />
        ),
        danger: true,
        disabled: isDeleting,
        onClick: handleDelete,
      });
    }
    return items;
  }, [
    shouldShowEditAction,
    shouldShowPublish,
    shouldShowDeleteAction,
    isDeleting,
    texts,
    handleEdit,
    handleOpenPublish,
    handleDelete,
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
          <DialDropdown
            items={manageItems}
            placement="bottom-end"
            matchReferenceWidth={false}
            listClassName="cp-dropdown-overlay"
          >
            <NeutralIconButton
              icon={<IconDots size={DIAL_ICON_SIZE.MD} aria-hidden />}
              aria-label={texts?.manageActionLabel ?? 'Manage'}
              aria-haspopup="menu"
            />
          </DialDropdown>
        )}
      </div>
      {isDeleting && (
        <span role="status" aria-live="polite" className="sr-only">
          {texts?.deletingStatusLabel ?? 'Deleting'}
        </span>
      )}
    </div>
  );
};

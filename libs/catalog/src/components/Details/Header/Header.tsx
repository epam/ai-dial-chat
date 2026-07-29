import { NeutralButton, PrimaryButton } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import {
  IconKey,
  IconLogin,
  IconLogout,
  IconPencil,
  IconPlayerPlayFilled,
} from '@tabler/icons-react';
import { FC, useCallback, type ReactNode } from 'react';
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
import { FolderPath } from '../../FolderPath/FolderPath';
import { ConnectButton } from './ConnectButton/ConnectButton';
import { DeleteButton } from './DeleteButton/DeleteButton';
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
  /**
   * Renders the Connect popover content anchored to the Connect button. When
   * absent, the Connect button is never shown.
   */
  connectOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode;
  /** Controls whether the "Connect" action is shown for the item. When absent, the Connect button is never shown. */
  isConnectVisible?: (item: CatalogItem) => boolean;
  onEdit?: (item: CatalogItem) => void;
  onDelete?: (item: CatalogItem) => Promise<void> | void;
  /** Called after a delete confirmed via the Delete button succeeds, to close the whole details panel. */
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
/** Right-side slide-in panel displaying full details for a catalog item. */
export const Header: FC<HeaderProps> = ({
  item,
  onUseInChat,
  isPrimaryActionVisible,
  onShare,
  shareOverlay,
  isShareVisible,
  connectOverlay,
  isConnectVisible,
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
    nameClassName = 'dial-body-semi-text text-primary',
    folderLabelClassName = 'dial-tiny-text',
    folderLeafClassName = 'dial-tiny-semi-text',
  } = detailsStyles?.typography ?? {};

  const handleUseInChat = useCallback(() => {
    onUseInChat?.(item);
  }, [item, onUseInChat]);

  const handleEdit = useCallback(() => {
    onEdit?.(item);
  }, [item, onEdit]);

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

  const credentialsUiState =
    item.credentials != null &&
    item.credentials.authenticationType !== ToolsetAuthenticationType.None
      ? getCredentialsUiState(item.credentials)
      : undefined;
  const shouldShowCredentialsAction =
    credentialsUiState != null && (!!onLogin || !!onLogout);

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
        nameClassName={nameClassName}
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
        {shouldShowPrimaryAction && (
          <PrimaryButton
            label={texts?.primaryActionLabel ?? 'Use in chat'}
            iconBefore={<IconPlayerPlayFilled size={DIAL_ICON_SIZE.MD} />}
            onClick={handleUseInChat}
          />
        )}
        {shouldShowEditAction && (
          <NeutralButton
            label={texts?.editActionLabel ?? 'Edit'}
            iconBefore={<IconPencil size={DIAL_ICON_SIZE.MD} />}
            onClick={handleEdit}
          />
        )}
        <ShareButton
          item={item}
          onShare={onShare}
          shareOverlay={shareOverlay}
          isShareVisible={isShareVisible}
          label={texts?.shareLabel}
        />
        <DeleteButton
          item={item}
          onDelete={onDelete}
          onDeleted={onCloseDetails}
          texts={texts}
        />
        {shouldShowPublish && (
          <NeutralButton
            label={texts?.publishLabel ?? 'Publish'}
            onClick={onOpenPublish}
          />
        )}
        {shouldShowCredentialsAction && (
          <NeutralButton
            label={credentialsLabel}
            iconBefore={credentialsIcon}
            onClick={handleCredentialsClick}
          />
        )}
        <ConnectButton
          item={item}
          connectOverlay={connectOverlay}
          isConnectVisible={isConnectVisible}
          label={texts?.connectLabel}
        />
      </div>
    </div>
  );
};

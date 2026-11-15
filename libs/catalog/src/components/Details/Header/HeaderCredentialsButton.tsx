import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  DropdownOverlayRole,
  type NeutralButton,
  type PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import {
  IconArrowRight,
  IconChevronDown,
  IconKey,
  IconLogin,
  IconLogout,
} from '@tabler/icons-react';
import { type FC, useCallback, useState } from 'react';
import type { HeaderProps } from '../../../models/details-header';
import {
  CredentialsLevel,
  CredentialsUiState,
  ToolsetAuthenticationType,
} from '../../../types/toolset-auth';
import { defaultManageCredentialsActionLabel } from '../../../utils/details-header-actions';
import { getDirectCredentialsLevel } from '../../../utils/toolset-credentials';
import { CredentialsApiKeyOverlay } from './CredentialsApiKeyOverlay/CredentialsApiKeyOverlay';

/** Props for {@link HeaderCredentialsButton}. */
export interface HeaderCredentialsButtonProps extends Pick<
  HeaderProps,
  | 'item'
  | 'onLogin'
  | 'onLogout'
  | 'onOpenCredentialsManagement'
  | 'onRequestLogout'
  | 'texts'
  | 'detailsStyles'
> {
  /** Kit button the action renders as: primary while it is the leading call to action. */
  buttonComponent: typeof PrimaryButton | typeof NeutralButton;
  /** Authentication type of the item's credentials. */
  authenticationType: ToolsetAuthenticationType;
  /** Resolved credentials state; the button renders only when it is set. */
  credentialsUiState: CredentialsUiState | undefined;
}

/** Credentials action of the details header: Log in / Log out, manage credentials, or the API-key popover trigger. */
export const HeaderCredentialsButton: FC<HeaderCredentialsButtonProps> = ({
  item,
  buttonComponent: ButtonComponent,
  authenticationType,
  credentialsUiState,
  onLogin,
  onLogout,
  onOpenCredentialsManagement,
  onRequestLogout,
  texts,
  detailsStyles,
}) => {
  const [isApiKeyOverlayOpen, setIsApiKeyOverlayOpen] = useState(false);

  /* API-key auth resolves to a popover trigger for every state except the
   * admin's "Manage API keys", which opens the dedicated sub-screen. */
  const isApiKeyOverlayTrigger =
    authenticationType === ToolsetAuthenticationType.ApiKey &&
    credentialsUiState !== CredentialsUiState.ManageCredentials;
  const apiKeyOverlayLevel =
    item.credentials != null
      ? getDirectCredentialsLevel(item.credentials)
      : CredentialsLevel.User;

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
    /* OAuth "Log in" outside the admin states has no level chooser: a public
     * toolset signs in personally (`USER`), a private one at the owner's own
     * `GLOBAL` level. The org-fallback nudge is conveyed by the banner below
     * the header, not by the button's wording. */
    if (item.credentials == null) return;
    onLogin?.(item, { level: getDirectCredentialsLevel(item.credentials) });
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
      return <IconKey size={DIAL_ICON_SIZE.MD} stroke={DIAL_KIT_ICON_STROKE} />;
    }
    if (authenticationType === ToolsetAuthenticationType.ApiKey) {
      return <IconKey size={DIAL_ICON_SIZE.MD} stroke={DIAL_KIT_ICON_STROKE} />;
    }
    return credentialsUiState === CredentialsUiState.LogOut ? (
      <IconLogout size={DIAL_ICON_SIZE.MD} stroke={DIAL_KIT_ICON_STROKE} />
    ) : (
      <IconLogin size={DIAL_ICON_SIZE.MD} stroke={DIAL_KIT_ICON_STROKE} />
    );
  })();

  const credentialsIconAfter = (() => {
    if (credentialsUiState === CredentialsUiState.ManageCredentials) {
      return (
        <IconArrowRight
          size={DIAL_ICON_SIZE.MD}
          className="rtl:scale-x-[-1]"
          stroke={DIAL_KIT_ICON_STROKE}
        />
      );
    }
    return isApiKeyOverlayTrigger ? (
      <IconChevronDown size={DIAL_ICON_SIZE.MD} stroke={DIAL_KIT_ICON_STROKE} />
    ) : undefined;
  })();

  const button = (
    <ButtonComponent
      label={credentialsLabel}
      iconBefore={credentialsIconBefore}
      iconAfter={credentialsIconAfter}
      onClick={handleCredentialsClick}
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
      /* A form panel, not a menu; the kit derives the trigger's
       * `aria-haspopup="dialog"` from this role. */
      overlayRole={DropdownOverlayRole.Dialog}
      overlayAriaLabel={texts?.personalApiKeyPanelTitle ?? 'Personal API key'}
      renderOverlay={() => (
        <CredentialsApiKeyOverlay
          item={item}
          level={apiKeyOverlayLevel}
          status={
            apiKeyOverlayLevel === CredentialsLevel.User
              ? item.credentials?.userStatus
              : item.credentials?.globalStatus
          }
          apiKeyAddedWhen={
            apiKeyOverlayLevel === CredentialsLevel.User
              ? item.credentials?.userApiKeyAddedWhen
              : item.credentials?.globalApiKeyAddedWhen
          }
          apiKeyHeader={item.credentials?.apiKeyHeader}
          onLogin={onLogin}
          onLogout={onLogout}
          onClose={() => setIsApiKeyOverlayOpen(false)}
          texts={texts}
          colors={detailsStyles?.colors}
          typography={detailsStyles?.typography}
        />
      )}
    >
      {button}
    </Dropdown>
  );
};

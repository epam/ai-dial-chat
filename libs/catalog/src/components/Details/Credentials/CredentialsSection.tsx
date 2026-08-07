import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DialAccordion,
  DialConfirmationPopup,
  NeutralButton,
  PrimaryButton,
  Input,
} from '@epam/ai-dial-ui-kit';
import { FC, useCallback, useState } from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import type { ItemDetailsTexts } from '../../../models/item-details-props';
import {
  CredentialsLevel,
  CredentialStatus,
  CredentialsUiState,
  ToolsetAuthenticationType,
} from '../../../types/toolset-auth';
import {
  getCredentialsUiState,
  getSignedInLevel,
} from '../../../utils/toolset-credentials';
import styles from './CredentialsSection.module.scss';

interface CredentialsSectionProps {
  item: CatalogItem;
  onLogin?: (
    item: CatalogItem,
    params: { level: CredentialsLevel; apiKey?: string },
  ) => void;
  onLogout?: (item: CatalogItem, params: { level: CredentialsLevel }) => void;
  texts?: ItemDetailsTexts;
  /** Typography class for the signed-in/signed-out status label. Default: `'dial-small-semi-text'`. */
  statusLabelClassName?: string;
}

/** One level's (`USER` or `GLOBAL`) login/logout form: status, API key/OAuth input, logout confirmation. */
interface LevelFormProps {
  item: CatalogItem;
  level: CredentialsLevel;
  status: CredentialStatus | undefined;
  authenticationType: ToolsetAuthenticationType;
  apiKeyHeader?: string;
  onLogin?: CredentialsSectionProps['onLogin'];
  onLogout?: CredentialsSectionProps['onLogout'];
  texts?: ItemDetailsTexts;
  statusLabelClassName?: string;
}

const LevelForm: FC<LevelFormProps> = ({
  item,
  level,
  status,
  authenticationType,
  apiKeyHeader,
  onLogin,
  onLogout,
  texts,
  statusLabelClassName = 'dial-small-semi-text',
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const isSignedIn = status === CredentialStatus.SignedIn;

  const handleSubmitApiKey = useCallback(() => {
    onLogin?.(item, { level, apiKey });
  }, [item, level, apiKey, onLogin]);

  const handleOAuthLogin = useCallback(() => {
    onLogin?.(item, { level });
  }, [item, level, onLogin]);

  const handleLogoutClick = useCallback(() => {
    setIsLogoutConfirmOpen(true);
  }, []);

  const handleConfirmLogout = useCallback(() => {
    setIsLogoutConfirmOpen(false);
    onLogout?.(item, { level });
  }, [item, level, onLogout]);

  const handleCancelLogout = useCallback(() => {
    setIsLogoutConfirmOpen(false);
  }, []);

  const loginActionLabel = texts?.loginActionLabel ?? 'Log in';
  const logoutActionLabel = texts?.logoutActionLabel ?? 'Log out';
  const statusLabel = isSignedIn
    ? (texts?.credentialsSignedInLabel ?? 'Signed in')
    : (texts?.credentialsSignedOutLabel ?? 'Signed out');
  const apiKeyHint =
    apiKeyHeader != null
      ? (texts?.apiKeyFieldHint?.(apiKeyHeader) ??
        `Enter your API key value for "${apiKeyHeader}" header`)
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      <span className={mergeClasses(statusLabelClassName, styles.statusLabel)}>
        {statusLabel}
      </span>

      {!isSignedIn &&
        authenticationType === ToolsetAuthenticationType.ApiKey && (
          <div className="flex items-end gap-2">
            <Input
              id={`catalog-item-${item.id}-${level}-api-key`}
              type="password"
              autoComplete="current-password"
              value={apiKey}
              onChange={(value) => setApiKey(value ?? '')}
              labelProps={{ label: texts?.apiKeyFieldLabel ?? 'API key' }}
              caption={apiKeyHint}
              containerClassName="min-w-0 flex-1"
            />
            <PrimaryButton
              label={loginActionLabel}
              onClick={handleSubmitApiKey}
              disabled={apiKey.trim().length === 0}
            />
          </div>
        )}

      {!isSignedIn &&
        authenticationType === ToolsetAuthenticationType.OAuth && (
          <PrimaryButton label={loginActionLabel} onClick={handleOAuthLogin} />
        )}

      {isSignedIn && (
        <NeutralButton label={logoutActionLabel} onClick={handleLogoutClick} />
      )}

      <DialConfirmationPopup
        open={isLogoutConfirmOpen}
        header={logoutActionLabel}
        description={
          texts?.logoutConfirmMessage ?? 'Are you sure you want to log out?'
        }
        confirmLabel={logoutActionLabel}
        onConfirm={handleConfirmLogout}
        onCancel={handleCancelLogout}
        onClose={handleCancelLogout}
      />
    </div>
  );
};

/** Inline login/logout section shown below the details panel header when the credentials action is expanded. */
export const CredentialsSection: FC<CredentialsSectionProps> = ({
  item,
  onLogin,
  onLogout,
  texts,
  statusLabelClassName,
}) => {
  const [openLevel, setOpenLevel] = useState<CredentialsLevel>(
    CredentialsLevel.User,
  );
  const credentials = item.credentials;

  if (credentials == null) {
    return null;
  }

  if (credentials.isManageableByAdmin) {
    return (
      <div
        role="region"
        aria-label={texts?.manageCredentialsActionLabel ?? 'Manage credentials'}
        className="flex flex-col gap-2 px-6 py-4 ps-[60px]"
      >
        <DialAccordion
          title={texts?.myCredentialsSectionLabel ?? 'My credentials'}
          expanded={openLevel === CredentialsLevel.User}
          onToggle={(expanded) =>
            setOpenLevel(expanded ? CredentialsLevel.User : openLevel)
          }
        >
          <LevelForm
            item={item}
            level={CredentialsLevel.User}
            status={credentials.userStatus}
            authenticationType={credentials.authenticationType}
            apiKeyHeader={credentials.apiKeyHeader}
            onLogin={onLogin}
            onLogout={onLogout}
            texts={texts}
            statusLabelClassName={statusLabelClassName}
          />
        </DialAccordion>
        <DialAccordion
          title={
            texts?.organizationCredentialsSectionLabel ??
            'Entire organization credentials'
          }
          expanded={openLevel === CredentialsLevel.Global}
          onToggle={(expanded) =>
            setOpenLevel(expanded ? CredentialsLevel.Global : openLevel)
          }
        >
          <LevelForm
            item={item}
            level={CredentialsLevel.Global}
            status={credentials.globalStatus}
            authenticationType={credentials.authenticationType}
            apiKeyHeader={credentials.apiKeyHeader}
            onLogin={onLogin}
            onLogout={onLogout}
            texts={texts}
            statusLabelClassName={statusLabelClassName}
          />
        </DialAccordion>
      </div>
    );
  }

  const uiState = getCredentialsUiState(credentials);
  let level: CredentialsLevel;
  if (uiState === CredentialsUiState.LoginWithMyCreds) {
    level = CredentialsLevel.User;
  } else if (uiState === CredentialsUiState.LogOut) {
    level = getSignedInLevel(credentials);
  } else {
    level = CredentialsLevel.Global;
  }

  return (
    <div
      role="region"
      aria-label={texts?.loginActionLabel ?? 'Log in'}
      className="px-6 py-4 ps-[60px]"
    >
      <LevelForm
        item={item}
        level={level}
        status={
          level === CredentialsLevel.User
            ? credentials.userStatus
            : credentials.globalStatus
        }
        authenticationType={credentials.authenticationType}
        apiKeyHeader={credentials.apiKeyHeader}
        onLogin={onLogin}
        onLogout={onLogout}
        texts={texts}
        statusLabelClassName={statusLabelClassName}
      />
    </div>
  );
};

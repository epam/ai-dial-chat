import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Checkbox,
  DangerButton,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  NeutralButton,
} from '@epam/ai-dial-ui-kit';
import { IconBuildingCommunity, IconUser } from '@tabler/icons-react';
import { useState, type FC } from 'react';
import type {
  ApplicationCredential,
  ApplicationCredentialsProps,
} from '../../../models/application-credentials';
import {
  CredentialsLevel,
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../../../types/toolset-auth';
import { CredentialsInfoCard } from '../../Details/Credentials/CredentialsInfoCard/CredentialsInfoCard';
import styles from '../../Details/Credentials/CredentialsManagementPanel/CredentialsManagementPanel.module.scss';
import { CredentialsRow } from '../../Details/Credentials/CredentialsRow/CredentialsRow';

interface ApplicationCredentialRowProps extends Pick<
  ApplicationCredentialsProps,
  'texts' | 'onLogin' | 'onLogout'
> {
  /** Host-resolved presentation of this service. */
  service: ApplicationCredential;
}

/** Per-service consent and removal confirmation around the shared credentials row. */
export const ApplicationCredentialRow: FC<ApplicationCredentialRowProps> = ({
  service,
  texts,
  onLogin,
  onLogout,
}) => {
  const [offlineUsageConsent, setOfflineUsageConsent] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string>();
  const isApiKey =
    service.authenticationType === ToolsetAuthenticationType.ApiKey;
  const removeLabel = isApiKey
    ? (texts?.deleteActionLabel ?? 'Delete')
    : (texts?.logoutActionLabel ?? 'Log out');
  const removeMessage = isApiKey
    ? (texts?.deleteApiKeyConfirmMessage?.(CredentialsLevel.User) ??
      'Are you sure you want to delete your personal API key?')
    : (texts?.logoutConfirmMessage ?? 'Are you sure you want to log out?');

  const handleLogout = async () => {
    if (isRemoving || !service.canLogout) return;
    setIsRemoving(true);
    setError(undefined);
    try {
      await onLogout(service.id);
      setIsConfirming(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <CredentialsRow
      label={service.name}
      description={service.description}
      icon={
        <IconUser
          size={DIAL_ICON_SIZE.SM}
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
        />
      }
      status={service.status}
      isActive={service.status === CredentialStatus.SignedIn}
      authenticationType={service.authenticationType}
      onLogin={(apiKey) => onLogin(service.id, { apiKey, offlineUsageConsent })}
      onRequestLogout={
        service.canLogout ? () => setIsConfirming(true) : undefined
      }
      onRequestDeleteApiKey={
        service.canLogout ? () => setIsConfirming(true) : undefined
      }
      disabled={isConfirming}
      isPending={isRemoving}
      texts={texts}
      labelClassName="dial-small-semi-text"
      descriptionClassName="dial-small-text"
      errorClassName="dial-caption-text"
      keyCardTitleClassName="dial-tiny-semi-text"
      keyCardDescriptionClassName="dial-tiny-text"
      deleteActionClassName={styles.errorText}
      renderLoginOptions={
        service.canConsentToOfflineUsage
          ? (disabled) => (
              <Checkbox
                isSelected={offlineUsageConsent}
                onChange={setOfflineUsageConsent}
                disabled={disabled}
                labelProps={{
                  label: texts?.offlineUsageConsent ?? 'Allow offline use',
                }}
                caption={texts?.offlineUsageConsentHint}
              />
            )
          : undefined
      }
    >
      {service.hint && (
        <p
          className={mergeClasses(
            'dial-small-text break-words',
            styles.description,
          )}
        >
          {service.hint}
        </p>
      )}
      {service.hasSharedCredentials && (
        <CredentialsInfoCard
          icon={
            <IconBuildingCommunity
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          title={
            texts?.sharedCredentials ??
            'Shared credentials are available for this service.'
          }
        />
      )}
      {isConfirming && (
        <div className="flex flex-col gap-3 pt-3">
          <p>{removeMessage}</p>
          {error && (
            <p role="alert" className={styles.errorText}>
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <NeutralButton
              className="min-h-11"
              label={texts?.cancelLabel ?? 'Cancel'}
              disabled={isRemoving}
              onClick={() => {
                setIsConfirming(false);
                setError(undefined);
              }}
            />
            <DangerButton
              className="min-h-11"
              label={removeLabel}
              disabled={isRemoving}
              onClick={handleLogout}
            />
          </div>
        </div>
      )}
    </CredentialsRow>
  );
};

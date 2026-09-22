import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  DangerButton,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Input,
  LinkButton,
  NeutralButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconKey } from '@tabler/icons-react';
import { type FC, type ReactNode, useCallback, useId, useState } from 'react';
import type { ItemDetailsTexts } from '../../../../models/item-details-props';
import {
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../../../../types/toolset-auth';
import { CredentialsIdentityIcon } from '../CredentialsIdentityIcon/CredentialsIdentityIcon';
import { CredentialsInfoCard } from '../CredentialsInfoCard/CredentialsInfoCard';
import styles from '../CredentialsManagementPanel/CredentialsManagementPanel.module.scss';

/** Props for {@link CredentialsRow}. */
interface CredentialsRowProps {
  /** Row title, e.g. `'Personal credentials'`. */
  label: string;
  /** Row description shown under the title. */
  description?: string;
  /** Leading icon shown in the row's identity chip. */
  icon: ReactNode;
  /** Current sign-in status for this level. */
  status: CredentialStatus | undefined;
  /**
   * Whether this level is the one actually in effect. Personal credentials
   * take precedence over organization-wide ones, so the organization row is
   * never `isActive` while the personal row is also signed in — only the
   * active level's checkmark is shown.
   */
  isActive: boolean;
  /** Authentication mechanism required by the item. */
  authenticationType: ToolsetAuthenticationType;
  /** Already-formatted relative time since the API key was added, shown when signed in via `API_KEY`. */
  apiKeyAddedWhen?: string;
  /** Called with the entered key (or no key, for OAuth) when the row's login action is submitted. May return a promise; the row shows a spinner in place of the action label until it resolves. */
  onLogin?: (apiKey?: string) => Promise<void | boolean> | void | boolean;
  /** Called when "Log out" is clicked on a signed-in OAuth row, so the host can show a full logout-confirmation sub-view for this level. */
  onRequestLogout?: () => void;
  /** Called when "Delete" is clicked on a configured API key, so the host can show a full delete-confirmation sub-view for this level. */
  onRequestDeleteApiKey?: () => void;
  /** Text overrides. */
  texts?: ItemDetailsTexts;
  /** CSS class applied to the row title. */
  labelClassName: string;
  /** CSS class applied to the row description. */
  descriptionClassName: string;
  /** CSS class applied to the empty-API-key validation message. */
  errorClassName: string;
  /** CSS class applied to the configured-key card's title. */
  keyCardTitleClassName: string;
  /** CSS class applied to the configured-key card's description. */
  keyCardDescriptionClassName: string;
  /** CSS class applied to the "Delete" action on a configured API key. */
  deleteActionClassName: string;
  /** Disables actions while an enclosing confirmation is submitting. Defaults to false. */
  disabled?: boolean;
  /** Whether an enclosing removal is running. Defaults to false. */
  isPending?: boolean;
  /** Additional login options, receiving the current pending state. */
  renderLoginOptions?: (disabled: boolean) => ReactNode;
  /** Supplemental content below the credentials controls. */
  children?: ReactNode;
}

/** Shared credentials row for toolset slots and application services. */
export const CredentialsRow: FC<CredentialsRowProps> = ({
  label,
  description,
  icon,
  status,
  isActive,
  authenticationType,
  apiKeyAddedWhen,
  onLogin,
  onRequestLogout,
  onRequestDeleteApiKey,
  texts,
  labelClassName,
  descriptionClassName,
  errorClassName,
  keyCardTitleClassName,
  keyCardDescriptionClassName,
  deleteActionClassName,
  disabled = false,
  isPending = false,
  renderLoginOptions,
  children,
}) => {
  const inputId = useId();
  const [error, setError] = useState<string>();
  const [apiKey, setApiKey] = useState('');
  const [hasEmptyKeyError, setHasEmptyKeyError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSignedIn = status === CredentialStatus.SignedIn;

  const handleApiKeyChange = useCallback((value?: string) => {
    setApiKey(value ?? '');
    setHasEmptyKeyError(false);
    setError(undefined);
  }, []);

  const handleLogin = async () => {
    if (isSaving || disabled) return;
    const isApiKey = authenticationType === ToolsetAuthenticationType.ApiKey;
    if (isApiKey && !apiKey.trim()) {
      setHasEmptyKeyError(true);
      return;
    }
    setIsSaving(true);
    setError(undefined);
    try {
      const succeeded = await onLogin?.(isApiKey ? apiKey : undefined);
      if (succeeded !== false) setApiKey('');
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const loginLabel = texts?.loginActionLabel ?? 'Log in';
  const logoutLabel = texts?.logoutActionLabel ?? 'Log out';
  const addLabel = texts?.addApiKeyActionLabel ?? 'Add';
  const deleteLabel = texts?.deleteActionLabel ?? 'Delete';
  const signedInLabel = texts?.credentialsSignedInLabel ?? 'Signed in';
  const signedOutLabel = texts?.credentialsSignedOutLabel ?? 'Signed out';
  const addingStatusLabel = texts?.addingApiKeyStatusLabel ?? 'Adding';
  const configuredMessage =
    texts?.apiKeyConfiguredMessage ?? 'Key has been configured';
  const addedWhenLabel =
    apiKeyAddedWhen != null
      ? (texts?.apiKeyAddedLabel ?? ((when) => `Added ${when}`))(
          apiKeyAddedWhen,
        )
      : undefined;

  return (
    <div
      role="group"
      aria-label={label}
      aria-busy={isSaving || isPending}
      className="flex min-w-0 items-start gap-3 rounded-xl p-3"
    >
      <CredentialsIdentityIcon
        icon={icon}
        isActive={isActive}
        statusLabel={isActive ? signedInLabel : signedOutLabel}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 break-words">
            <span className={labelClassName}>{label}</span>
            <span
              className={mergeClasses(
                descriptionClassName,
                styles.rowDescription,
              )}
            >
              {description}
            </span>
          </div>
          {authenticationType === ToolsetAuthenticationType.OAuth &&
            (isSignedIn ? (
              onRequestLogout && (
                <DangerButton
                  appearance={ButtonAppearance.Ghost}
                  label={logoutLabel}
                  className="min-h-11 min-w-28 shrink-0 justify-center whitespace-nowrap"
                  onClick={onRequestLogout}
                  disabled={isSaving || disabled}
                />
              )
            ) : (
              <NeutralButton
                label={isSaving ? undefined : loginLabel}
                aria-label={loginLabel}
                iconBefore={
                  isSaving ? (
                    <Spinner size={DIAL_ICON_SIZE.SM} ariaLabel={loginLabel} />
                  ) : undefined
                }
                disabled={isSaving || disabled}
                className="min-h-11 min-w-28 shrink-0 justify-center whitespace-nowrap"
                onClick={handleLogin}
              />
            ))}
        </div>

        {authenticationType === ToolsetAuthenticationType.ApiKey &&
          !isSignedIn && (
            <div className="flex animate-fadeIn flex-col gap-1 pt-1">
              <div className="flex items-end gap-2">
                <Input
                  id={inputId}
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={handleApiKeyChange}
                  labelProps={{ label: texts?.apiKeyFieldLabel ?? 'API key' }}
                  invalid={hasEmptyKeyError}
                  disabled={isSaving || disabled}
                  containerClassName="min-w-0 flex-1"
                />
                <NeutralButton
                  label={isSaving ? undefined : addLabel}
                  aria-label={isSaving ? addingStatusLabel : undefined}
                  iconBefore={
                    isSaving ? (
                      <Spinner
                        size={DIAL_ICON_SIZE.SM}
                        ariaLabel={addingStatusLabel}
                      />
                    ) : undefined
                  }
                  className="min-h-11 shrink-0 whitespace-nowrap"
                  onClick={handleLogin}
                  disabled={isSaving || disabled}
                />
              </div>
              {/*
               * Rendered below the input+button row, not through Input's own
               * `error` prop, so the button never shifts when it appears.
               */}
              {hasEmptyKeyError && (
                <span
                  role="alert"
                  className={mergeClasses(errorClassName, styles.errorText)}
                >
                  {texts?.apiKeyRequiredErrorMessage ?? 'API key is required.'}
                </span>
              )}
            </div>
          )}

        {authenticationType === ToolsetAuthenticationType.ApiKey &&
          isSignedIn && (
            <div className="animate-fadeIn pt-1">
              <CredentialsInfoCard
                icon={
                  <IconKey
                    size={DIAL_ICON_SIZE.SM}
                    aria-hidden
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                }
                title={configuredMessage}
                description={addedWhenLabel}
                titleClassName={keyCardTitleClassName}
                descriptionClassName={keyCardDescriptionClassName}
                action={
                  onRequestDeleteApiKey && (
                    <LinkButton
                      label={deleteLabel}
                      className={mergeClasses(
                        'min-h-11',
                        deleteActionClassName,
                      )}
                      onClick={onRequestDeleteApiKey}
                      disabled={isSaving || disabled}
                    />
                  )
                }
              />
            </div>
          )}
        {!isSignedIn && renderLoginOptions?.(isSaving || disabled)}
        {error && (
          <p
            role="alert"
            className={mergeClasses(errorClassName, styles.errorText)}
          >
            {error}
          </p>
        )}
        {children}
      </div>
    </div>
  );
};

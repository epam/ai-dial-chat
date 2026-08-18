import { EntityHeader, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DangerButton,
  DIAL_ICON_SIZE,
  Input,
  LinkButton,
  NeutralButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import {
  IconBuildingCommunity,
  IconCircleCheckFilled,
  IconKey,
  IconUser,
} from '@tabler/icons-react';
import { FC, ReactNode, useCallback, useState } from 'react';
import type { CatalogItem } from '../../../../models/catalog-item';
import type {
  ItemDetailsStyles,
  ItemDetailsTexts,
} from '../../../../models/item-details-props';
import {
  CredentialsLevel,
  CredentialStatus,
  ToolsetAuthenticationType,
} from '../../../../types/toolset-auth';
import { CredentialsInfoCard } from '../CredentialsInfoCard/CredentialsInfoCard';
import styles from './CredentialsManagementPanel.module.scss';

/** Props for {@link CredentialsManagementRow}. */
interface CredentialsManagementRowProps {
  /** Item the row manages credentials for. */
  item: CatalogItem;
  /** Credentials slot this row manages. */
  level: CredentialsLevel;
  /** Row title, e.g. `'Personal credentials'`. */
  label: string;
  /** Row description shown under the title. */
  description: string;
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
  onLogin?: (
    item: CatalogItem,
    params: { level: CredentialsLevel; apiKey?: string },
  ) => Promise<void> | void;
  /** Called when "Log out" is clicked on a signed-in OAuth row, so the host can show a full logout-confirmation sub-view for this level. */
  onRequestLogout?: (level: CredentialsLevel) => void;
  /** Called when "Delete" is clicked on a configured API key, so the host can show a full delete-confirmation sub-view for this level. */
  onRequestDeleteApiKey?: (level: CredentialsLevel) => void;
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
}

/** One credentials slot (personal or organization) in the admin management sub-screen: status, and a login/logout or add/delete-key action. */
const CredentialsManagementRow: FC<CredentialsManagementRowProps> = ({
  item,
  level,
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
}) => {
  const [apiKey, setApiKey] = useState('');
  const [hasEmptyKeyError, setHasEmptyKeyError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSignedIn = status === CredentialStatus.SignedIn;

  const handleLogin = useCallback(() => {
    onLogin?.(item, { level });
  }, [item, level, onLogin]);

  const handleApiKeyChange = useCallback((value?: string) => {
    setApiKey(value ?? '');
    setHasEmptyKeyError(false);
  }, []);

  const handleAddApiKey = useCallback(async () => {
    if (apiKey.trim().length === 0) {
      setHasEmptyKeyError(true);
      return;
    }
    setIsSaving(true);
    try {
      await onLogin?.(item, { level, apiKey });
      setApiKey('');
    } finally {
      setIsSaving(false);
    }
  }, [item, level, apiKey, onLogin]);

  const handleRequestLogout = useCallback(() => {
    onRequestLogout?.(level);
  }, [level, onRequestLogout]);

  const handleRequestDeleteApiKey = useCallback(() => {
    onRequestDeleteApiKey?.(level);
  }, [level, onRequestDeleteApiKey]);

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
    <div className="flex items-start gap-3">
      <div className="relative shrink-0">
        <div
          className={mergeClasses(
            'flex size-8 items-center justify-center rounded-lg',
            styles.surface,
          )}
        >
          {icon}
        </div>
        {isActive && (
          <IconCircleCheckFilled
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            className={mergeClasses(
              'absolute -end-1 -top-1',
              styles.activeIcon,
            )}
          />
        )}
        <span className="sr-only">
          {isActive ? signedInLabel : signedOutLabel}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
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
              <DangerButton
                label={logoutLabel}
                className="w-28 shrink-0 justify-center whitespace-nowrap"
                onClick={handleRequestLogout}
              />
            ) : (
              <NeutralButton
                label={loginLabel}
                className="w-28 shrink-0 justify-center whitespace-nowrap"
                onClick={handleLogin}
              />
            ))}
        </div>

        {authenticationType === ToolsetAuthenticationType.ApiKey &&
          !isSignedIn && (
            <div className="flex animate-fadeIn flex-col gap-1 pt-1">
              <div className="flex items-end gap-2">
                <Input
                  id={`catalog-item-${item.id}-${level}-api-key`}
                  type="password"
                  autoComplete="current-password"
                  value={apiKey}
                  onChange={handleApiKeyChange}
                  labelProps={{ label: texts?.apiKeyFieldLabel ?? 'API key' }}
                  invalid={hasEmptyKeyError}
                  disabled={isSaving}
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
                  className="shrink-0 whitespace-nowrap"
                  onClick={handleAddApiKey}
                  disabled={isSaving}
                />
              </div>
              {/*
               * Rendered below the input+button row, not through Input's own
               * `error` prop, so the button never shifts when it appears.
               */}
              {hasEmptyKeyError && (
                <span
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
                icon={<IconKey size={DIAL_ICON_SIZE.SM} aria-hidden />}
                title={configuredMessage}
                description={addedWhenLabel}
                titleClassName={keyCardTitleClassName}
                descriptionClassName={keyCardDescriptionClassName}
                action={
                  <LinkButton
                    label={deleteLabel}
                    className={deleteActionClassName}
                    onClick={handleRequestDeleteApiKey}
                  />
                }
              />
            </div>
          )}
      </div>
    </div>
  );
};

/** Props for {@link CredentialsManagementPanel}. */
interface CredentialsManagementPanelProps {
  /** Item whose personal and organization credentials are managed. */
  item: CatalogItem;
  /** Called when a login action (OAuth or API-key add) is submitted for either level. May return a promise; the submitting row shows a spinner in place of its action label until it resolves. */
  onLogin?: (
    item: CatalogItem,
    params: { level: CredentialsLevel; apiKey?: string },
  ) => Promise<void> | void;
  /** Called when "Log out" is clicked on a signed-in OAuth row, so the host can show a full logout-confirmation sub-view for the given level. */
  onRequestLogout?: (level: CredentialsLevel) => void;
  /** Called when "Delete" is clicked on a configured API key, so the host can show a full delete-confirmation sub-view for the given level. */
  onRequestDeleteApiKey?: (level: CredentialsLevel) => void;
  /** Text overrides. */
  texts?: ItemDetailsTexts;
  /**
   * Style overrides. Typography classes are read from `typography`; colors are
   * applied as CSS custom properties on the `DetailsPanel` root and cascade in.
   */
  detailsStyles?: ItemDetailsStyles;
  /** CSS class applied to the "Delete" action on a configured API key. Defaults to `'text-error'`. */
  deleteActionClassName?: string;
}

const defaultCredentialsManagementDescription = (
  authenticationType: ToolsetAuthenticationType,
): string =>
  authenticationType === ToolsetAuthenticationType.ApiKey
    ? 'Select which account to use with this toolset — personal or organization. If both are configured, personal credentials will be used by default for toolset access.'
    : 'Select which account to use with this toolset — personal or organization. If both are configured, personal credentials will be used by default.';

/** Admin sub-screen listing an item's personal and organization-wide credentials slots, each independently manageable. Reached via the details header's "Manage credentials"/"Manage API keys" action. */
export const CredentialsManagementPanel: FC<
  CredentialsManagementPanelProps
> = ({
  item,
  onLogin,
  onRequestLogout,
  onRequestDeleteApiKey,
  texts,
  detailsStyles,
  deleteActionClassName = 'text-error',
}) => {
  const {
    credentialsDescriptionClassName = 'dial-body-paragraph-text',
    credentialsRowLabelClassName = 'dial-small-semi-text',
    credentialsRowDescriptionClassName = 'dial-small-text',
    credentialsErrorClassName = 'dial-caption-text',
    credentialsKeyCardTitleClassName = 'dial-tiny-semi-text',
    credentialsKeyCardDescriptionClassName = 'dial-tiny-text',
  } = detailsStyles?.typography ?? {};

  const credentials = item.credentials;
  if (credentials == null) {
    return null;
  }

  const description = (
    texts?.credentialsManagementDescription ??
    defaultCredentialsManagementDescription
  )(credentials.authenticationType);

  /*
   * Only one level is ever "in effect": personal credentials take precedence
   * over organization-wide ones (per the description above), so the
   * organization row's checkmark stays hidden while personal is also
   * signed in, even though both may be independently configured.
   */
  const isUserActive = credentials.userStatus === CredentialStatus.SignedIn;
  const isGlobalActive =
    !isUserActive && credentials.globalStatus === CredentialStatus.SignedIn;

  return (
    <div className="flex flex-col">
      {/* Padding matches Figma's "Identity" section (px-24 py-16) — a separate section from the description/rows below, not one contiguous gap. */}
      <div className="px-6 py-4">
        {/* Background matches the Publish flow's agent summary card (`bg-layer-sunken`), not the shared InfoCard's info/danger tint — this is a neutral identity chip, not a warning. */}
        <div className={mergeClasses('rounded-xl p-3', styles.surface)}>
          <EntityHeader item={item} iconSize={40} hasFeaturedTag={false} />
        </div>
      </div>
      {/* Padding and gap match Figma's "Authorisation" section (px-24 py-16, gap-20). */}
      <div className="flex flex-col gap-5 px-6 py-4">
        <span
          className={mergeClasses(
            credentialsDescriptionClassName,
            styles.description,
          )}
        >
          {description}
        </span>
        <div className="flex flex-col gap-4">
          <CredentialsManagementRow
            item={item}
            level={CredentialsLevel.User}
            label={texts?.personalCredentialsLabel ?? 'Personal credentials'}
            description={
              texts?.personalCredentialsDescription ??
              'These credentials apply only to your account.'
            }
            icon={<IconUser size={DIAL_ICON_SIZE.SM} aria-hidden />}
            status={credentials.userStatus}
            isActive={isUserActive}
            authenticationType={credentials.authenticationType}
            apiKeyAddedWhen={credentials.userApiKeyAddedWhen}
            onLogin={onLogin}
            onRequestLogout={onRequestLogout}
            onRequestDeleteApiKey={onRequestDeleteApiKey}
            texts={texts}
            labelClassName={credentialsRowLabelClassName}
            descriptionClassName={credentialsRowDescriptionClassName}
            errorClassName={credentialsErrorClassName}
            keyCardTitleClassName={credentialsKeyCardTitleClassName}
            keyCardDescriptionClassName={credentialsKeyCardDescriptionClassName}
            deleteActionClassName={deleteActionClassName}
          />
          <CredentialsManagementRow
            item={item}
            level={CredentialsLevel.Global}
            label={
              texts?.organizationCredentialsLabel ?? 'Organization credentials'
            }
            description={
              texts?.organizationCredentialsDescription ??
              'Once added, these credentials will grant all users in your organization access to this toolset.'
            }
            icon={
              <IconBuildingCommunity size={DIAL_ICON_SIZE.SM} aria-hidden />
            }
            status={credentials.globalStatus}
            isActive={isGlobalActive}
            authenticationType={credentials.authenticationType}
            apiKeyAddedWhen={credentials.globalApiKeyAddedWhen}
            onLogin={onLogin}
            onRequestLogout={onRequestLogout}
            onRequestDeleteApiKey={onRequestDeleteApiKey}
            texts={texts}
            labelClassName={credentialsRowLabelClassName}
            descriptionClassName={credentialsRowDescriptionClassName}
            errorClassName={credentialsErrorClassName}
            keyCardTitleClassName={credentialsKeyCardTitleClassName}
            keyCardDescriptionClassName={credentialsKeyCardDescriptionClassName}
            deleteActionClassName={deleteActionClassName}
          />
        </div>
      </div>
    </div>
  );
};

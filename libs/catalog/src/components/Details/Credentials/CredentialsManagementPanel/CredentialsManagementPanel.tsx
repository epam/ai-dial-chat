import { EntityHeader, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconBuildingCommunity, IconUser } from '@tabler/icons-react';
import type { FC } from 'react';
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
import { CredentialsRow } from '../CredentialsRow/CredentialsRow';
import styles from './CredentialsManagementPanel.module.scss';

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
        <div className="flex flex-col">
          <CredentialsRow
            label={texts?.personalCredentialsLabel ?? 'Personal credentials'}
            description={
              texts?.personalCredentialsDescription ??
              'These credentials apply only to your account.'
            }
            icon={
              <IconUser
                size={DIAL_ICON_SIZE.SM}
                aria-hidden
                stroke={DIAL_KIT_ICON_STROKE}
              />
            }
            status={credentials.userStatus}
            isActive={isUserActive}
            authenticationType={credentials.authenticationType}
            apiKeyAddedWhen={credentials.userApiKeyAddedWhen}
            onLogin={(apiKey) =>
              onLogin?.(item, {
                level: CredentialsLevel.User,
                ...(apiKey != null ? { apiKey } : {}),
              })
            }
            onRequestLogout={() => onRequestLogout?.(CredentialsLevel.User)}
            onRequestDeleteApiKey={() =>
              onRequestDeleteApiKey?.(CredentialsLevel.User)
            }
            texts={texts}
            labelClassName={credentialsRowLabelClassName}
            descriptionClassName={credentialsRowDescriptionClassName}
            errorClassName={credentialsErrorClassName}
            keyCardTitleClassName={credentialsKeyCardTitleClassName}
            keyCardDescriptionClassName={credentialsKeyCardDescriptionClassName}
            deleteActionClassName={deleteActionClassName}
          />
          <CredentialsRow
            label={
              texts?.organizationCredentialsLabel ?? 'Organization credentials'
            }
            description={
              texts?.organizationCredentialsDescription ??
              'Once added, these credentials will grant all users in your organization access to this toolset.'
            }
            icon={
              <IconBuildingCommunity
                size={DIAL_ICON_SIZE.SM}
                aria-hidden
                stroke={DIAL_KIT_ICON_STROKE}
              />
            }
            status={credentials.globalStatus}
            isActive={isGlobalActive}
            authenticationType={credentials.authenticationType}
            apiKeyAddedWhen={credentials.globalApiKeyAddedWhen}
            onLogin={(apiKey) =>
              onLogin?.(item, {
                level: CredentialsLevel.Global,
                ...(apiKey != null ? { apiKey } : {}),
              })
            }
            onRequestLogout={() => onRequestLogout?.(CredentialsLevel.Global)}
            onRequestDeleteApiKey={() =>
              onRequestDeleteApiKey?.(CredentialsLevel.Global)
            }
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

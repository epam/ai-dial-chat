import { buildCssVars } from '@epam/ai-dial-chat-shared';
import type { PublishFolderNode } from '@epam/ai-dial-publish-panel';
import type { CSSProperties } from 'react';
import type { PublishedFolder } from '../models/details-panel';
import type { ItemDetailsColors } from '../models/item-details-props';
import { DetailsConfirmationKind } from '../types/details-confirmation';
import {
  CredentialsLevel,
  ToolsetAuthenticationType,
} from '../types/toolset-auth';

/** One published folder needs no choice; several require the user to pick one. */
export const resolveUnpublishFolder = (
  folders: PublishedFolder[],
  selectedKey: string | null,
): PublishedFolder | undefined => {
  if (selectedKey != null) {
    return folders.find((folder) => folder.key === selectedKey);
  }
  return folders.length === 1 ? folders[0] : undefined;
};

/*
 * A catalog publication cannot overwrite an existing version: DIAL Core
 * rejects an `ADD` whose target exists ("Target resource already exists"),
 * rejects a `DELETE` + `ADD` pair on the same target as duplicate urls, and
 * `ADD_IF_ABSENT` silently skips the copy. So an already-published version
 * blocks submit instead of offering "Update version" (issue #9427).
 */
/** Whether the catalog's publish flow may replace an already-published version. Always `false`. */
export const CATALOG_PUBLISH_ALLOWS_REPLACE = false;
/** Publish handler used when the host supplies none. */
export const NO_OP_PUBLISH = async () => undefined;
/** Stable empty folder list for the `publishFolderItems` default. */
export const EMPTY_PUBLISH_FOLDERS: PublishFolderNode[] = [];
/** Stable empty list for the `ruleSourceOptions` default. */
export const EMPTY_RULE_SOURCE_OPTIONS: string[] = [];

/** Default consequences listed under the Delete confirmation. */
export const DEFAULT_DELETE_CONSEQUENCES = [
  'All shared configurations will be lost',
  'Users who rely on it will lose access',
  'Cannot be undone',
];

/** Default consequences listed under the Remove-from-My-List confirmation. */
export const DEFAULT_UNSHARE_CONSEQUENCES = [
  'You will lose access to this item',
  'Other people keep their access',
  'You will need a new invitation to get it back',
];

/** Default consequences listed under the Unpublish confirmation. */
export const DEFAULT_UNPUBLISH_CONSEQUENCES = [
  'Everyone loses access to the published copy',
  'Your own copy is not deleted',
  'You can publish it again later',
];

/** Default consequences listed under the Revoke-access confirmation. */
export const DEFAULT_REVOKE_SHARE_CONSEQUENCES = [
  'Everyone you shared it with loses access',
  'Existing share links stop working',
  'You keep full access — nothing is deleted',
];

/** Returns the default credentials-management sub-view title for an authentication type. */
export const defaultCredentialsManagementTitle = (
  authenticationType: ToolsetAuthenticationType,
): string =>
  authenticationType === ToolsetAuthenticationType.ApiKey
    ? 'Toolset API keys'
    : 'Toolset credentials';

/** Returns the default API-key delete confirmation message for a credentials level. */
export const defaultDeleteApiKeyConfirmMessage = (
  level: CredentialsLevel,
): string =>
  level === CredentialsLevel.Global
    ? 'Are you sure you want to delete the organization API key?'
    : 'Are you sure you want to delete your personal API key?';

/*
 * Whether confirming a given step takes the item out of the caller's own
 * view. `Delete` destroys it and `Unshare` drops the caller's own grant, so
 * both close the whole panel; `Logout` and `RevokeAccess` leave the item
 * exactly where it was for the caller — revoking removes *other people's*
 * access — so those return to the details content instead.
 */
/** Confirmation kinds that close the details panel once confirmed. */
export const CONFIRMATIONS_REMOVING_ITEM_FROM_VIEW =
  new Set<DetailsConfirmationKind>([
    DetailsConfirmationKind.Delete,
    DetailsConfirmationKind.Unshare,
  ]);

/** Maps the details panel color overrides to the CSS custom properties its stylesheets read. */
export const getDetailsPanelCssVars = (
  detailsColors: ItemDetailsColors | undefined,
): CSSProperties =>
  buildCssVars({
    '--cat-details-backdrop': detailsColors?.backdrop,
    '--cat-details-bg': detailsColors?.background,
    '--cat-details-border': detailsColors?.border,
    '--cat-details-divider': detailsColors?.divider,
    '--cat-details-scrollbar': detailsColors?.scrollbar,
    '--cat-details-skeleton': detailsColors?.skeleton,
    '--cat-details-name-text': detailsColors?.nameText,
    '--cat-details-publish-title-text': detailsColors?.publishTitleText,
    // '--cat-credentials-status-text': detailsColors?.credentialsStatusText,
    '--cat-details-content-text': detailsColors?.contentText,
    '--cat-details-variable-text': detailsColors?.variableText,
    '--cat-details-file-count-text': detailsColors?.contentFileCountText,
    '--cat-api-heading-text': detailsColors?.apiHeadingText,
    '--cat-tools-divider': detailsColors?.toolsDivider,
    '--cat-tools-description-text': detailsColors?.toolsDescriptionText,
    '--cat-tools-count-text': detailsColors?.toolsCountText,
    '--cat-grid-border': detailsColors?.gridBorder,
    '--cat-grid-header-text': detailsColors?.gridHeaderText,
    '--cat-grid-header-bg': detailsColors?.gridHeaderBackground,
    '--cat-grid-cell-text': detailsColors?.gridCellText,
    '--cat-grid-cell-divider': detailsColors?.gridCellDivider,
    '--cat-grid-row-even-bg': detailsColors?.gridRowEvenBackground,
    '--cat-cred-surface-bg': detailsColors?.credentialsSurfaceBackground,
    '--cat-cred-active-icon': detailsColors?.credentialsActiveIcon,
    '--cat-cred-banner-icon-bg': detailsColors?.credentialsBannerIconBackground,
    '--cat-cred-description-text': detailsColors?.credentialsDescriptionText,
    '--cat-cred-row-description-text':
      detailsColors?.credentialsRowDescriptionText,
    '--cat-cred-error-text': detailsColors?.credentialsErrorText,
    '--cat-cred-delete-action-text': detailsColors?.credentialsDeleteActionText,
    '--cat-details-limit-reached-bg': detailsColors?.limitReachedBackground,
    '--cat-details-limit-reached-text': detailsColors?.limitReachedText,
    '--cat-details-limit-running-low-bg':
      detailsColors?.limitRunningLowBackground,
    '--cat-details-limit-running-low-text': detailsColors?.limitRunningLowText,
    '--cat-cred-card-bg': detailsColors?.credentialsCardBackground,
    '--cat-cred-card-icon': detailsColors?.credentialsCardIcon,
    '--cat-cred-card-title-text': detailsColors?.credentialsCardTitleText,
    '--cat-cred-card-description-text':
      detailsColors?.credentialsCardDescriptionText,
  });

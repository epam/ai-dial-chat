import type {
  PublicationRule,
  PublishFolderNode,
  PublishFooterLabels,
  PublishHistoryEntry,
  PublishPanelLabels,
} from '@epam/ai-dial-publish-panel';
import type { ReactNode } from 'react';
import type {
  CredentialsLevel,
  ToolsetAuthenticationType,
} from '../types/toolset-auth';
import type { CatalogItem } from './catalog-item';

/** Text overrides for all user-visible strings in `DetailsPanel`. */
export interface ItemDetailsTexts {
  /** "Share" action button label. Default: `'Share'`. */
  shareLabel?: string;
  /** "Connect" tab label (resource ID, endpoint, and code snippets). Default: `'Connect'`. */
  tabConnectLabel?: string;
  /** Accessible label for the icon-only "Manage" button (opens the Edit/Publish/Delete menu). Default: `'Manage'`. */
  manageActionLabel?: string;
  /** "About" tab label. Default: `'About'`. */
  tabAboutLabel?: string;
  /** Content tab label, shown for items carrying a text body. Default: `'Details'`. */
  tabContentLabel?: string;
  /** "Overview" tab label. Default: `'Overview'`. */
  tabOverviewLabel?: string;
  /** "Pricing" tab label. Default: `'Pricing'`. */
  tabPricingLabel?: string;
  /** "Limits" tab label. Default: `'Limits'`. */
  tabLimitsLabel?: string;
  /** Accessible label for the details panel `role="dialog"`. Default: `'Item details'`. */
  ariaLabel?: string;
  /** Accessible label for the close button. Default: `'Close'`. */
  closeAriaLabel?: string;
  /** Accessible label for the star button when the item is not starred. Default: `'Add to favorites'`. */
  addToFavoritesAriaLabel?: string;
  /** Accessible label for the star button when the item is already starred. Default: `'Remove from favorites'`. */
  removeFromFavoritesAriaLabel?: string;
  /** "Yes" label for boolean-true spec values. Default: `'Yes'`. */
  overviewYesLabel?: string;
  /** "No" label for boolean-false spec values. Default: `'No'`. */
  overviewNoLabel?: string;
  /** "Tools" tab label. Default: `'Tools'`. */
  tabToolsLabel?: string;
  /** Label on the "Featured" tag chip shown when the entity is featured. Default: `'Featured'`. */
  featuredLabel?: string;
  /** Primary action button label. Default: `'Use in chat'`. */
  primaryActionLabel?: string;
  /** "Publish" action button label. Default: `'Publish'`. */
  publishLabel?: string;
  /** Title shown in the panel header while the Publish view is open. Default: `'Publish'`. */
  publishTitle?: string;
  /** Accessible label for the back button that returns from the Publish view to details. Default: `'Back'`. */
  backToDetailsAriaLabel?: string;
  /** When `false`, the primary action button is hidden. Default: `true`. */
  hasPrimaryAction?: boolean;
  /** "Edit" action button label. Default: `'Edit'`. */
  editActionLabel?: string;
  /** "Download" action button label. Default: `'Download'`. */
  downloadActionLabel?: string;
  /** "Resource" section heading in the API tab. Default: `'Resource'`. */
  apiResourceSectionLabel?: string;
  /** "Code snippet" section heading in the API tab. Default: `'Code snippet'`. */
  apiSnippetSectionLabel?: string;
  /** "Model ID" row label in the API tab. Default: `'Model ID'`. */
  apiModelIdLabel?: string;
  /** Title shown in the single-endpoint code block's header in the Connect tab. Default: `'Endpoint'`. */
  apiEndpointLabel?: string;
  /** "Endpoint" section heading above the multi-endpoint selector in the Connect tab. Default: `'Endpoint'`. */
  apiEndpointSectionLabel?: string;
  /** "Request example" row label in the API tab. Default: `'Request example'`. */
  apiRequestExampleLabel?: string;
  /** "Response schema" row label in the API tab. Default: `'Response schema'`. */
  apiResponseSchemaLabel?: string;
  /** Accessible label for the copy-to-clipboard button. Default: `'Copy'`. */
  copyCodeAriaLabel?: string;
  /** "Token pricing" section heading in the Pricing tab. Default: `'Token pricing'`. */
  pricingPricesSectionLabel?: string;
  /** "Usage limits" section heading in the Pricing tab. Default: `'Usage limits'`. */
  pricingLimitsSectionLabel?: string;
  /** Accessible label for the loading placeholder shown next to the tab row while structured details are being fetched. Default: `'Loading details'`. */
  detailsLoadingAriaLabel?: string;
  /** "Log in" action button label, shown when the item's credentials are not signed in. Default: `'Log in'`. */
  loginActionLabel?: string;
  /** "Log out" action button label, shown when the item's credentials are signed in. Default: `'Log out'`. */
  logoutActionLabel?: string;
  /**
   * Returns the "Manage credentials"/"Manage API keys" action button label
   * for an admin managing a public item, given its authentication type.
   * Default: `(type) => type === ToolsetAuthenticationType.ApiKey ? 'Manage API keys' : 'Manage credentials'`.
   */
  manageCredentialsActionLabel?: (
    authenticationType: ToolsetAuthenticationType,
  ) => string;
  /** Status label shown next to a signed-in row, and as the accessible name of its checkmark indicator. Default: `'Signed in'`. */
  credentialsSignedInLabel?: string;
  /** Status label shown next to a signed-out row. Default: `'Signed out'`. */
  credentialsSignedOutLabel?: string;
  /** Confirmation dialog message shown before logging out. Default: `'Are you sure you want to log out?'`. */
  logoutConfirmMessage?: string;
  /**
   * Returns the confirmation dialog message shown before deleting an API
   * key, given which level's key is being deleted. Default:
   * `(level) => level === CredentialsLevel.Global ? 'Are you sure you want to delete the organization API key?' : 'Are you sure you want to delete your personal API key?'`.
   */
  deleteApiKeyConfirmMessage?: (level: CredentialsLevel) => string;
  /** Label for the API key input field. Default: `'API key'`. */
  apiKeyFieldLabel?: string;
  /** Validation error shown under the API key input when "Add" is submitted with an empty value. Default: `'API key is required.'`. */
  apiKeyRequiredErrorMessage?: string;
  /** Credentials-status badge label shown on catalog cards when signed out. Default: `'LOGGED OUT'`. */
  credentialsBadgeLoggedOutLabel?: string;
  /**
   * Top action button label when the item requires an API key and the
   * current user has not added their personal key yet. Default: `'API key'`.
   */
  apiKeyActionLabel?: string;
  /**
   * Top action button label when the item requires an API key and the
   * current user already has a personal key on file. Default: `'Change API key'`.
   */
  changeApiKeyActionLabel?: string;
  /** Title of the personal API-key popover opened from the top action button. Default: `'Personal API key'`. */
  personalApiKeyPanelTitle?: string;
  /** Confirmation line shown in the personal API-key popover once a key is on file. Default: `'Personal key has been added'`. */
  personalApiKeyAddedMessage?: string;
  /** Confirmation line shown in the admin credentials-management row once that level's API key is on file. Default: `'Key has been configured'`. */
  apiKeyConfiguredMessage?: string;
  /** "Add" action label for submitting a new API key. Default: `'Add'`. */
  addApiKeyActionLabel?: string;
  /** Status text announced to assistive tech while an API key is being added. Default: `'Adding'`. */
  addingApiKeyStatusLabel?: string;
  /**
   * Returns the caption shown under an on-file API key, given an
   * already-formatted relative time. Default: `(when) => \`Added ${when}\``.
   */
  apiKeyAddedLabel?: (when: string) => string;
  /**
   * Returns the banner title shown when the current user is not signed in
   * personally but organization-wide credentials keep the item usable,
   * given the item's authentication type. Default:
   * `(type) => type === ToolsetAuthenticationType.ApiKey ? 'You are currently using organization API key to access this toolset.' : 'You are currently using organization credentials to access this toolset.'`.
   */
  orgFallbackBannerTitle?: (
    authenticationType: ToolsetAuthenticationType,
  ) => string;
  /**
   * Returns the banner description paired with `orgFallbackBannerTitle`,
   * given the item's authentication type. Default:
   * `(type) => type === ToolsetAuthenticationType.ApiKey ? 'Configure your personal API key to have access to your data.' : 'Login using personal account to have access to your data.'`.
   */
  orgFallbackBannerDescription?: (
    authenticationType: ToolsetAuthenticationType,
  ) => string;
  /**
   * Returns the banner title shown to an admin when organization-wide
   * credentials are active, given the item's authentication type. Default:
   * `(type) => type === ToolsetAuthenticationType.ApiKey ? 'Signed in with organization API key.' : 'Signed in with organization credentials.'`.
   */
  orgCredentialsActiveBannerTitle?: (
    authenticationType: ToolsetAuthenticationType,
  ) => string;
  /**
   * Returns the banner title shown to an admin when their own personal
   * credentials are active (and take precedence over any organization-wide
   * credentials), given the item's authentication type. Default:
   * `(type) => type === ToolsetAuthenticationType.ApiKey ? 'Signed in with personal API key.' : 'Signed in with personal credentials.'`.
   */
  personalCredentialsActiveBannerTitle?: (
    authenticationType: ToolsetAuthenticationType,
  ) => string;
  /**
   * Returns the title of the admin credentials-management sub-screen, given
   * the item's authentication type. Default:
   * `(type) => type === ToolsetAuthenticationType.ApiKey ? 'Toolset API keys' : 'Toolset credentials'`.
   */
  credentialsManagementTitle?: (
    authenticationType: ToolsetAuthenticationType,
  ) => string;
  /**
   * Returns the description shown under the identity chip in the admin
   * credentials-management sub-screen, given the item's authentication
   * type. Default:
   * `(type) => 'Select which account to use with this toolset — personal or organization. If both are configured, personal credentials will be used by default' + (type === ToolsetAuthenticationType.ApiKey ? ' for toolset access.' : '.')`.
   */
  credentialsManagementDescription?: (
    authenticationType: ToolsetAuthenticationType,
  ) => string;
  /** Row label for the current user's own credentials in the admin management sub-screen. Default: `'Personal credentials'`. */
  personalCredentialsLabel?: string;
  /** Row description for the current user's own credentials in the admin management sub-screen. Default: `'These credentials apply only to your account.'`. */
  personalCredentialsDescription?: string;
  /** Row label for organization-wide credentials in the admin management sub-screen. Default: `'Organization credentials'`. */
  organizationCredentialsLabel?: string;
  /** Row description for organization-wide credentials in the admin management sub-screen. Default: `'Once added, these credentials will grant all users in your organization access to this toolset.'`. */
  organizationCredentialsDescription?: string;
  /** "Delete" action button label. Default: `'Delete'`. */
  deleteActionLabel?: string;
  /** Status text announced to assistive tech while a delete is in progress. Default: `'Deleting'`. */
  deletingStatusLabel?: string;
  /** Title of the delete confirmation step. Default: the `deleteActionLabel` value. */
  deleteConfirmTitle?: string;
  /**
   * Returns the delete confirmation's body copy, given the item's display
   * name. Default:
   * `(name) => \`Are you sure you want to delete ${name}? This action is permanent and cannot be undone.\`` (with the name emphasized).
   */
  deleteConfirmMessage?: (name: string) => ReactNode;
  /**
   * Consequences listed as bullets in the delete confirmation. Default:
   * `['All shared configurations will be lost', 'Users who rely on it will lose access', 'Cannot be undone']`.
   * Pass `[]` to render no list.
   */
  deleteConfirmConsequences?: string[];
  /** Recipient-side "Remove from My List" action and confirmation label. Default: `'Remove from My List'`. */
  unshareLabel?: string;
  /** Title of the confirmation step shown before removing a shared item. Default: `'Remove from My List'`. */
  unshareConfirmTitle?: string;
  /**
   * Returns the removal confirmation's body copy, given the item's display
   * name. Default:
   * `(name) => \`Remove ${name} from your list? You'll need a new invitation to access it again.\`` (with the name emphasized).
   */
  unshareConfirmMessage?: (name: string) => ReactNode;
  /**
   * Consequences listed as bullets in the removal confirmation. Default:
   * `['You will lose access to this item', 'Other people keep their access', 'You will need a new invitation to get it back']`.
   * Pass `[]` to render no list.
   */
  unshareConfirmConsequences?: string[];
  /** Status text announced to assistive tech while a removal is in progress. Default: `'Removing'`. */
  unsharingStatusLabel?: string;
  /** Owner-side "Revoke access" action and confirmation label. Default: `'Revoke access'`. */
  revokeShareLabel?: string;
  /**
   * Returns the "Revoke access" menu label when the number of users holding
   * access is known, so the owner can see the blast radius before opening the
   * confirmation. Falls back to `revokeShareLabel` when the count is unknown.
   * Default: `(count) => \`Revoke access (${count})\``.
   */
  revokeShareLabelWithCount?: (count: number) => string;
  /** Title of the confirmation step shown before revoking everyone's shared access. Default: `'Revoke access'`. */
  revokeShareConfirmTitle?: string;
  /**
   * Returns the revoke confirmation's body copy, given the item's display
   * name. Default:
   * `(name) => \`Revoke shared access to ${name}? Anyone you shared it with will lose access.\`` (with the name emphasized).
   */
  revokeShareConfirmMessage?: (name: string) => ReactNode;
  /**
   * Consequences listed as bullets in the revoke confirmation. Default:
   * `['Everyone you shared it with loses access', 'Existing share links stop working', 'You keep full access — nothing is deleted']`.
   * Pass `[]` to render no list.
   */
  revokeShareConfirmConsequences?: string[];
  /** Status text announced to assistive tech while a revoke is in progress. Default: `'Revoking access'`. */
  revokingShareStatusLabel?: string;
  /** Status text announced to assistive tech while a logout is in progress. Default: `'Logging out'`. */
  loggingOutStatusLabel?: string;
  /** Generic "Cancel" label, used by every confirmation step. Default: `'Cancel'`. */
  cancelLabel?: string;
}

/** Typography class overrides for `DetailsPanel` text elements. */
export interface ItemDetailsTypography {
  /** Typography class for the entity name. Default: `'dial-body-semi-text'`. */
  nameClassName?: string;
  /** Typography class for a sub-view header title (publish, share, credentials). Default: `'dial-body-semi-text'`. */
  subViewTitleClassName?: string;
  /** Typography class for the version string. Default: `'dial-tiny-text'`. */
  versionClassName?: string;
  /** Typography class for section headings inside the description content. Default: `'dial-small-semi-text'`. */
  contentHeadingClassName?: string;
  /** Typography class for the description body text. Default: `'dial-small-text'`. */
  contentClassName?: string;
  /** Typography class for Overview section headings. Default: `'dial-caption-text'`. */
  overviewSectionClassName?: string;
  /** Typography class for spec row labels (left column). Default: `'dial-small-semi-text'`. */
  overviewLabelClassName?: string;
  /** Typography class for string and "No" spec values. Default: `'dial-small-text'`. */
  overviewValueClassName?: string;
  /** Typography class for "Yes" spec values. Default: `'dial-small-text'`. */
  overviewValueTrueClassName?: string;
  /** Typography class applied to folder path separator labels. Default: `'dial-tiny-text'`. */
  folderLabelClassName?: string;
  /** Typography class applied to the leaf (last) folder path segment. Default: `'dial-tiny-semi-text'`. */
  folderLeafClassName?: string;
  /** Typography class for a confirmation step's body copy and consequence bullets. Default: `'dial-small-text'`. */
  confirmMessageClassName?: string;
  /** Typography class for the credentials-management sub-screen's description. Default: `'dial-body-paragraph-text'`. */
  credentialsDescriptionClassName?: string;
  /** Typography class for a credentials row's title. Default: `'dial-small-semi-text'`. */
  credentialsRowLabelClassName?: string;
  /** Typography class for a credentials row's description. Default: `'dial-small-text'`. */
  credentialsRowDescriptionClassName?: string;
  /** Typography class for the empty-API-key validation message. Default: `'dial-caption-text'`. */
  credentialsErrorClassName?: string;
  /** Typography class for the configured-API-key card's title. Default: `'dial-tiny-semi-text'`. */
  credentialsKeyCardTitleClassName?: string;
  /** Typography class for the configured-API-key card's description. Default: `'dial-tiny-text'`. */
  credentialsKeyCardDescriptionClassName?: string;
}

/**
 * Color overrides for `DetailsPanel` and everything it renders, applied as CSS
 * custom properties on the panel root so they cascade into the nested header,
 * credentials, summary, spec-grid and tools sections.
 */
export interface ItemDetailsColors {
  /** Backdrop overlay color behind the panel. Fallback: `--bg-backdrop`. */
  backdrop?: string;
  /** Panel surface background. Fallback: `--bg-layer-raised`. */
  background?: string;
  /** Panel's leading-edge border color (desktop only). Fallback: `--stroke-secondary`. */
  border?: string;
  /** Horizontal divider color between panel sections. Fallback: `--stroke-tertiary`. */
  divider?: string;
  /** Scrollbar thumb color of the scrollable content area. Fallback: `--stroke-secondary`. */
  scrollbar?: string;
  /** Shimmer color of the tab-row loading skeleton. Fallback: `--bg-layer-4`. */
  skeleton?: string;
  /** Entity name text color in the header. Fallback: `--text-primary`. */
  nameText?: string;
  /** Title text color of a sub-view (publish or a confirmation step). Fallback: `--text-primary`. */
  publishTitleText?: string;
  /** Border color of the "current version" tag. Fallback: `--stroke-tertiary`. */
  versionTagBorder?: string;
  /** Background color of the "current version" tag. Fallback: `--bg-accent-primary-alpha`. */
  versionTagBackground?: string;
  /** Text color of the "current version" tag. Fallback: `--text-accent`. */
  versionTagText?: string;
  /** Body text color of the Content tab. Fallback: `--text-primary`. */
  contentText?: string;
  /** Text color of a `{{placeholder}}` token in the Content tab's body. Fallback: `--text-prompt-parameter`. */
  variableText?: string;
  /** Heading color of the API section. Fallback: `--text-secondary`. */
  apiHeadingText?: string;
  /** Divider color between tool entries. Fallback: `--stroke-tertiary`. */
  toolsDivider?: string;
  /** Tool description text color. Fallback: `--text-secondary`. */
  toolsDescriptionText?: string;
  /** Spec-grid outer border color. Fallback: `--stroke-secondary`. */
  gridBorder?: string;
  /** Spec-grid header text color. Fallback: `--text-secondary`. */
  gridHeaderText?: string;
  /** Spec-grid header background. Fallback: `--bg-layer-1`. */
  gridHeaderBackground?: string;
  /** Spec-grid cell text color. Fallback: `--text-primary`. */
  gridCellText?: string;
  /** Spec-grid cell top-border color. Fallback: `--stroke-secondary`. */
  gridCellDivider?: string;
  /** Spec-grid even-row background. Fallback: `--bg-layer-7`. */
  gridRowEvenBackground?: string;
  /** `InfoCard` surface color in its `Info` variant. Fallback: `--bg-info`. */
  infoCardBackground?: string;
  /** `InfoCard` surface color in its `Danger` variant. Fallback: `--bg-error`. */
  infoCardDangerBackground?: string;
  /** Confirmation body-copy text color. Fallback: `--text-primary`. */
  confirmMessageText?: string;
  /** Confirmation consequence-bullet text color. Fallback: `--text-secondary`. */
  confirmConsequenceText?: string;
  /** Top border color of the confirmation action row. Fallback: `--stroke-tertiary`. */
  confirmFooterBorder?: string;
  /** Background of the credentials sub-screen's identity card and its rows' icon chips. Fallback: `--bg-layer-sunken`. */
  credentialsSurfaceBackground?: string;
  /** Color of the checkmark marking the credentials level currently in effect. Fallback: `--text-success`. */
  credentialsActiveIcon?: string;
  /** Text color of the credentials sub-screen's description. Fallback: `--text-primary`. */
  credentialsDescriptionText?: string;
  /** Text color of a credentials row's description. Fallback: `--text-tertiary`. */
  credentialsRowDescriptionText?: string;
  /** Text color of the empty-API-key validation message. Fallback: `--text-error`. */
  credentialsErrorText?: string;
  /** Surface color of the credentials status card used by the banner, the configured-key card, and the personal API-key popover. Fallback: `--bg-layer-base`. */
  credentialsCardBackground?: string;
  /** Color of the credentials status card's leading icon. Fallback: `--text-secondary`. */
  credentialsCardIcon?: string;
  /** Title text color of the credentials status card. Fallback: `--text-primary`. */
  credentialsCardTitleText?: string;
  /** Description text color of the credentials status card. Fallback: `--text-secondary`. */
  credentialsCardDescriptionText?: string;
}

/** Grouped style overrides for `DetailsPanel`. */
export interface ItemDetailsStyles {
  /** Typography class overrides for text elements. */
  typography?: ItemDetailsTypography;
  /** Color overrides applied as CSS custom properties on the panel root. */
  colors?: ItemDetailsColors;
}

/** Props for `DetailsPanel`. */
export interface DetailsPanelProps {
  /** The catalog item to display in the panel. */
  item: CatalogItem;
  /** Controls whether the panel is visible. */
  isOpen: boolean;
  /** Initial starred state for the item. Default: `false`. */
  isStarred?: boolean;
  /**
   * When `true`, a fetch for structured detail tabs (Overview/Pricing/API/Tools)
   * is pending; the panel shows a small loading indicator next to the tab row.
   */
  isDetailsLoading?: boolean;
  /** Called when the panel should close (close button or backdrop click). */
  onClose: () => void;
  /** Called when the star/favorite button is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /**
   * Additional caller-supplied rule for whether the "Remove from My List"
   * action is shown, combined (AND) with the built-in
   * `sharedWithMe`/`isMyApp` rule. Defaults to `true` when absent.
   */
  isUnshareVisible?: (item: CatalogItem) => boolean;
  /** Called when the "Use in chat" button is clicked. */
  onUseInChat?: (item: CatalogItem) => void;
  /** Controls whether the primary action button is shown for the item. */
  isPrimaryActionVisible?: (item: CatalogItem) => boolean;
  /** Called when the "Share" button is clicked. */
  onShare?: (item: CatalogItem) => void;
  /** Controls whether the "Publish" action is shown for the item. */
  isPublishVisible?: (item: CatalogItem) => boolean;
  /** Resolves previously published versions for an item, most recent first. */
  getPublishHistory?: (item: CatalogItem) => Promise<PublishHistoryEntry[]>;
  /** Root-level destination folder nodes offered by the publish flow. */
  publishFolderItems?: PublishFolderNode[];
  /**
   * Externally-controlled set of expanded publish-folder path keys
   * (`path.join('/')`). Pass this together with `onPublishExpandedPathsChange`
   * when the host lazily fetches a folder's children on expand.
   */
  publishExpandedPaths?: Set<string>;
  /** Called when the set of expanded publish folders changes; required to control `publishExpandedPaths`. */
  onPublishExpandedPathsChange?: (paths: Set<string>) => void;
  /** Publish-folder path keys currently being fetched by the host. */
  publishLoadingPaths?: Set<string>;
  /** Resolves whether the current user can publish to a given folder path. */
  hasPublishWriteAccess?: (folderPath: string[]) => boolean;
  /** Called with the destination folder path and current access rules when the user confirms publish/update. */
  onPublish?: (
    item: CatalogItem,
    folderPath: string[],
    rules: PublicationRule[],
  ) => Promise<void>;
  /** Called after a successful publish; use this to surface a success notification. */
  onPublishSuccess?: (item: CatalogItem, folderPath: string[]) => void;
  /** Called with the rejection reason when a publish request fails; use this to surface an error notification. */
  onPublishError?: (
    item: CatalogItem,
    folderPath: string[],
    error: unknown,
  ) => void;
  /** Called when the user confirms a new folder name in the publish flow. */
  onCreatePublishFolder?: (parentPath: string[], name: string) => void;
  /** Text overrides forwarded to the publish flow. */
  publishLabels?: PublishPanelLabels & PublishFooterLabels;
  /** Options offered in the access-rules editor's source picker. Defaults to `[]` when absent. */
  ruleSourceOptions?: string[];
  /**
   * Resolves the access rules already configured for a destination folder,
   * called whenever the selected folder changes. The result fully replaces
   * the rules editor's contents. Omit to skip pre-filling entirely.
   */
  onFetchExistingRules?: (folderPath: string[]) => Promise<PublicationRule[]>;
  /**
   * Renders the Share popover content anchored to the Share button. When
   * provided, clicking Share opens this popover instead of calling `onShare`.
   */
  shareOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode;
  /**
   * Additional caller-supplied rule for whether the "Share" action is shown
   * for the item, combined (AND) with the built-in ownership/type rule.
   * Absent means the built-in rule alone decides.
   */
  isShareVisible?: (item: CatalogItem) => boolean;
  /** Called when the "Edit" button is clicked. Shown only when the item's `isEditable` is `true`. */
  onEdit?: (item: CatalogItem) => void;
  /**
   * Called when the "Download" action is clicked, with no confirmation step.
   * The panel does not await the result or show a pending state, so the host
   * owns any progress and failure feedback.
   */
  onDownload?: (item: CatalogItem) => Promise<void> | void;
  /**
   * Narrows which items offer the "Download" action. Defaults to `true`
   * (visible for every item) whenever `onDownload` is supplied.
   */
  isDownloadVisible?: (item: CatalogItem) => boolean;
  /**
   * Called immediately when the "Delete" button is clicked, with no
   * confirmation step. Shown only when the item's `isMyApp` is `true` and
   * its `type` is `Application` or `Toolset`. May return a promise; the
   * button shows a disabled state while pending.
   */
  onDelete?: (item: CatalogItem) => Promise<void> | void;
  /**
   * Called when removal is confirmed via the confirmation popup, for an item
   * shared with the current user (`sharedWithMe: true`). May return a
   * promise; the popup shows a loading state and prevents duplicate
   * submission while pending.
   */
  onUnshare?: (item: CatalogItem) => Promise<void> | void;
  /**
   * Called when revocation is confirmed for an item the current user owns
   * (`isMyApp: true`), removing every recipient's shared access at once. May
   * return a promise; the confirmation shows a loading state and prevents
   * duplicate submission while pending. The item stays in the owner's
   * catalog, so the panel returns to its details content on success.
   */
  onRevokeShare?: (item: CatalogItem) => Promise<void> | void;
  /**
   * Resolves how many users currently hold shared access to an owned item.
   * Called when the owner opens the Manage menu, so "Revoke access" is gated
   * and labelled on a count that is never stale. `0` hides the action;
   * `undefined` (or a rejection) leaves it reachable without a count. Omit to
   * offer the action for every owned item.
   */
  onFetchRecipientsCount?: (item: CatalogItem) => Promise<number | undefined>;
  /**
   * Additional caller-supplied rule for whether "Revoke access" is shown,
   * combined (AND) with the built-in `isMyApp` rule and the recipient count.
   * Defaults to `true` when absent.
   */
  isRevokeShareVisible?: (item: CatalogItem) => boolean;
  /**
   * Called when the credentials login form is submitted. `level` identifies
   * which credentials slot the call applies to (`USER` for the current
   * user's own credentials; `GLOBAL` for organization-wide credentials,
   * only reachable by an admin managing a public item). `apiKey` is present
   * for API-key authentication and absent for OAuth (where this call should
   * initiate a redirect). Shown only when the item's `credentials` field is
   * present with an `authenticationType` other than `NONE`. May return a
   * promise; the panel awaits it before refreshing credential status via
   * `onFetchDetails`.
   */
  onLogin?: (
    item: CatalogItem,
    params: { level: CredentialsLevel; apiKey?: string },
  ) => Promise<void> | void;
  /**
   * Called when logout is confirmed in the credentials section, for the
   * given credentials `level`. May return a promise; the panel awaits it
   * before refreshing credential status via `onFetchDetails`.
   */
  onLogout?: (
    item: CatalogItem,
    params: { level: CredentialsLevel },
  ) => Promise<void> | void;
  /** Text overrides for all user-visible strings. */
  texts?: ItemDetailsTexts;
  /** Grouped style overrides. */
  styles?: ItemDetailsStyles;
}

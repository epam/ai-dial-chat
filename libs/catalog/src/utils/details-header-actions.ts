import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { HeaderProps } from '../models/details-header';
import { RecipientsCountStatus } from '../types/recipients-count';
import {
  CredentialsUiState,
  ToolsetAuthenticationType,
} from '../types/toolset-auth';
import { getCredentialsUiState } from './toolset-credentials';

/** Returns the default label of the admin credentials-management action for an authentication type. */
export const defaultManageCredentialsActionLabel = (
  authenticationType: ToolsetAuthenticationType,
): string =>
  authenticationType === ToolsetAuthenticationType.ApiKey
    ? 'Manage API keys'
    : 'Manage credentials';

/** Parameters for {@link resolveHeaderActionVisibility}. */
export interface HeaderActionVisibilityParams extends Pick<
  HeaderProps,
  | 'item'
  | 'texts'
  | 'isReadonly'
  | 'isPrimaryActionVisible'
  | 'onOpenUnpublish'
  | 'hasPublishedFolders'
  | 'isUnpublishVisible'
  | 'isPublishHistoryResolved'
  | 'isPublishVisible'
  | 'onEdit'
  | 'isShareVisible'
  | 'isSharePrimary'
  | 'isPublishPrimary'
  | 'onLogin'
  | 'onLogout'
  | 'onDownload'
  | 'isDownloadVisible'
  | 'isDownloadPrimary'
  | 'onUnshare'
  | 'isUnshareVisible'
  | 'onRevokeShare'
  | 'onFetchRecipientsCount'
  | 'isRevokeShareVisible'
> {
  /** State of the recipient-count lookup, from `useRecipientsCount`. */
  recipientsCountStatus: RecipientsCountStatus;
  /** Resolved recipient count, from `useRecipientsCount`. */
  recipientsCount: number | undefined;
}

/** Resolves which header actions show, and on which surface, for one item. */
export const resolveHeaderActionVisibility = ({
  item,
  texts,
  isReadonly = false,
  isPrimaryActionVisible,
  onOpenUnpublish,
  hasPublishedFolders = false,
  isUnpublishVisible,
  isPublishHistoryResolved = true,
  isPublishVisible,
  onEdit,
  isShareVisible,
  isSharePrimary,
  isPublishPrimary,
  onLogin,
  onLogout,
  onDownload,
  isDownloadVisible,
  isDownloadPrimary,
  onUnshare,
  isUnshareVisible,
  onRevokeShare,
  onFetchRecipientsCount,
  isRevokeShareVisible,
  recipientsCountStatus,
  recipientsCount,
}: HeaderActionVisibilityParams) => {
  const shouldShowPrimaryAction =
    texts?.hasPrimaryAction !== false &&
    (isPrimaryActionVisible?.(item) ??
      (item.type === CatalogEntityType.Model ||
        item.type === CatalogEntityType.Agent ||
        item.type === CatalogEntityType.Prompt));

  /*
   * Gated on resolved history rather than staying reachable the way "Revoke
   * access" does on an unresolved count: revoke needs the lookup only for a
   * number in its label, while unpublish needs the folder itself to build the
   * request, so an entry shown without one could not do anything if clicked.
   */
  const shouldShowUnpublish =
    !isReadonly &&
    !!onOpenUnpublish &&
    hasPublishedFolders &&
    (isUnpublishVisible?.(item) ?? true);

  /*
   * An item the host affirmatively calls unpublishable has its history
   * resolved up front, without waiting for hover — which is what un-deadlocks
   * a published copy whose only entry would be "Unpublish" ([#8691](https://github.com/epam/ai-dial-chat/issues/8691)).
   * While that lookup is outstanding the Manage slot renders nothing at all:
   * the caller may turn out to have no right to unpublish, and a speculative
   * trigger shown in the meantime flashed and vanished on every first open
   * ([#9500](https://github.com/epam/ai-dial-chat/issues/9500)). The slot
   * appears once, in its settled form.
   *
   * It reads `=== true` rather than defaulting the way `shouldShowUnpublish`
   * does: a host that supplies no rule gets no up-front lookup, so holding
   * the slot back would hide its menu until a hover that could never happen.
   */
  const isUnpublishPending =
    !isReadonly &&
    !!onOpenUnpublish &&
    !isPublishHistoryResolved &&
    isUnpublishVisible?.(item) === true;

  /*
   * "Publish" and "Unpublish" are mutually exclusive: the panel offers
   * whichever one matches the item's current state, never both at once. An
   * item with no published copy offers "Publish"; once history resolves to at
   * least one published folder, "Unpublish" takes its place.
   *
   * This does hide a second publish of an already-published item (to another
   * folder, or a re-publish of the same one). That is the trade the
   * single-state action buys, and republishing stays reachable by unpublishing
   * first.
   *
   * Because the history lookup is lazy (see `handleManageTriggerIntent` and
   * `handlePublishTriggerIntent`), it can start as "Publish" and become
   * "Unpublish" once the response arrives — which is why the lookup is fired
   * on hover/focus of the trigger rather than on click, so it is usually
   * settled before the action becomes visible.
   */
  const shouldShowPublish =
    !isReadonly &&
    !shouldShowUnpublish &&
    (isPublishVisible?.(item) ??
      (item.type === CatalogEntityType.Model ||
        item.type === CatalogEntityType.Toolset ||
        item.type === CatalogEntityType.Agent));

  const shouldShowEditAction = !isReadonly && !!onEdit && !!item.isEditable;

  /*
   * Sharing is limited to entities the current user owns (deployments and
   * toolsets in their personal space), not the whole catalog — anything else
   * would offer an entry with no defined behavior. `ShareButton` applies the
   * same rule itself, so this only gates the Manage-menu arrangement.
   */
  const shouldShowShareAction =
    !isReadonly && item.isMyApp === true && (isShareVisible?.(item) ?? true);

  /*
   * Which surface each of Share and Publish lands on. The defaults are the
   * historical arrangement — Share as its own button in the action row,
   * Publish inside the Manage menu — and a host that wants the reverse flips
   * one or both. Each action renders on exactly one of the two surfaces.
   */
  const isShareInActionRow = isSharePrimary?.(item) ?? true;
  const isPublishInActionRow = isPublishPrimary?.(item) ?? false;

  const authenticationType =
    item.credentials?.authenticationType ?? ToolsetAuthenticationType.None;
  const credentialsUiState =
    item.credentials != null &&
    authenticationType !== ToolsetAuthenticationType.None
      ? getCredentialsUiState(item.credentials)
      : undefined;
  const shouldShowCredentialsAction =
    !isReadonly && credentialsUiState != null && (!!onLogin || !!onLogout);
  /* Toolsets have no "Use in chat" primary action, so the credentials
   * button (Log in / Log out / manage) takes over as their primary,
   * leading action instead. */
  const isCredentialsActionPrimary =
    item.type === CatalogEntityType.Toolset && shouldShowCredentialsAction;

  const isDownloadActionEnabled =
    !!onDownload && (isDownloadVisible?.(item) ?? true);
  /* Credentials, where active, always keeps the primary slot ahead of Download. */
  const isDownloadActionPrimary =
    isDownloadActionEnabled &&
    !isCredentialsActionPrimary &&
    (isDownloadPrimary?.(item) ??
      (item.type === CatalogEntityType.Skill && !shouldShowPrimaryAction));
  /* A promoted Download renders in the primary slot only — never duplicated in the Manage menu. */
  const shouldShowDownloadAction =
    isDownloadActionEnabled && !isDownloadActionPrimary;
  const shouldShowDeleteAction = !isReadonly && item.isMyApp;
  /*
   * The recipient-side "Remove from My List" action is the counterpart of
   * Delete: it discards only the current user's own access, so it shows
   * exclusively for items shared with them. `isMyApp` and `sharedWithMe` are
   * mutually exclusive for a given item, so Delete and this action never
   * render at the same time.
   */
  const shouldShowUnshareAction =
    !isReadonly &&
    !!onUnshare &&
    item.isMyApp !== true &&
    item.sharedWithMe === true &&
    (isUnshareVisible?.(item) ?? true);
  /*
   * The owner-side counterpart: revoking removes *other people's* access to
   * an item the caller owns, so it renders alongside Delete and never with
   * "Remove from My List". It also stays hidden while nobody holds access —
   * an action that would be a no-op is noise.
   *
   * The count is resolved when this menu opens rather than carried on the
   * item, so it is never a stale snapshot from a list fetch (revoking once
   * would otherwise leave the action offering to revoke again). Until it
   * settles the entry is withheld; a lookup that cannot produce a number
   * still shows it, so a transient failure never removes the only way to
   * revoke.
   */
  const shouldShowRevokeShareAction =
    !isReadonly &&
    !!onRevokeShare &&
    item.isMyApp === true &&
    (!onFetchRecipientsCount ||
      recipientsCountStatus === RecipientsCountStatus.Unknown ||
      (recipientsCountStatus === RecipientsCountStatus.Resolved &&
        (recipientsCount ?? 0) > 0)) &&
    (isRevokeShareVisible?.(item) ?? true);

  /*
   * Whether a lazily resolved entry could still join the Manage menu, which
   * keeps a lone remaining action from being promoted (see `useManageActions`).
   */
  const isUnpublishRuleAffirmed = isUnpublishVisible?.(item);
  const mayGainUnpublishEntry =
    !isReadonly &&
    !!onOpenUnpublish &&
    (isUnpublishRuleAffirmed == null ||
      (isUnpublishRuleAffirmed && !isPublishHistoryResolved));
  const mayGainRevokeShareEntry =
    !isReadonly &&
    !!onRevokeShare &&
    !!onFetchRecipientsCount &&
    item.isMyApp === true &&
    (isRevokeShareVisible?.(item) ?? true);
  /* Once a personal API key is on file, the trigger drops from the
   * call-to-action (primary) look to the same low-emphasis style as Share —
   * matching the design's "Change API key" state. */
  const isApiKeyConfigured =
    authenticationType === ToolsetAuthenticationType.ApiKey &&
    credentialsUiState === CredentialsUiState.LogOut;
  const isOAuthLoginLogoutButton =
    authenticationType !== ToolsetAuthenticationType.ApiKey &&
    credentialsUiState !== CredentialsUiState.ManageCredentials;
  const isOAuthLogoutState =
    isOAuthLoginLogoutButton &&
    credentialsUiState === CredentialsUiState.LogOut;

  return {
    shouldShowPrimaryAction,
    shouldShowUnpublish,
    isUnpublishPending,
    shouldShowPublish,
    shouldShowEditAction,
    shouldShowShareAction,
    isShareInActionRow,
    isPublishInActionRow,
    authenticationType,
    credentialsUiState,
    shouldShowCredentialsAction,
    isCredentialsActionPrimary,
    isDownloadActionPrimary,
    shouldShowDownloadAction,
    shouldShowDeleteAction,
    shouldShowUnshareAction,
    shouldShowRevokeShareAction,
    mayGainUnpublishEntry,
    mayGainRevokeShareEntry,
    isApiKeyConfigured,
    isOAuthLogoutState,
  };
};

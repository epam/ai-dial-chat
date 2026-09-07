import type { CatalogItem } from '@epam/ai-dial-catalog';
import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import { useCallback } from 'react';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import {
  discardSharedCatalogItem,
  getShareRecipientsCount,
  revokeSharedAccess,
} from '../../server-api/share.api';
import { useUiFeature } from '../useUiFeature';

interface NotificationParams {
  message: string;
  title?: string;
  requestId?: string;
}

interface UseCatalogSharingParams {
  t: TFunction;
  refetchToolsets: () => Promise<void>;
  refetchSkills: () => Promise<void>;
  refetchPrompts: () => Promise<void>;
  refetchDeployments: () => Promise<void>;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  showSuccessNotification: (params: NotificationParams) => void;
  showErrorNotification: (params: NotificationParams) => void;
}

interface UseCatalogSharingResult {
  isShareVisible: (item: CatalogItem) => boolean;
  isUnshareVisible: (item: CatalogItem) => boolean;
  isRevokeShareVisible: (item: CatalogItem) => boolean;
  handleUnshare: (item: CatalogItem) => Promise<void>;
  handleRevokeShare: (item: CatalogItem) => Promise<void>;
  handleFetchRecipientsCount: (
    item: CatalogItem,
  ) => Promise<number | undefined>;
}

/**
 * Owns the catalog's share/unshare/revoke-access flow: the Share action's
 * visibility rules, the unshare and revoke-access mutations and their
 * success/error notifications, and the recipients-count lookup the details
 * panel's Manage menu resolves on open.
 */
export const useCatalogSharing = ({
  t,
  refetchToolsets,
  refetchSkills,
  refetchPrompts,
  refetchDeployments,
  selectedItemId,
  setSelectedItemId,
  showSuccessNotification,
  showErrorNotification,
}: UseCatalogSharingParams): UseCatalogSharingResult => {
  const isApplicationsSharingEnabled = useUiFeature(
    OverlayFeature.ApplicationsSharing,
  );
  const isToolsetsSharingEnabled = useUiFeature(OverlayFeature.ToolsetsSharing);

  const isShareVisible = useCallback(
    (item: CatalogItem) => {
      /*
       * Only your own prompts can be shared: DIAL Core grants access from the
       * owner's bucket, which is the only one the backend can qualify a
       * bucket-relative prompt path against.
       */
      if (item.type === CatalogEntityType.Prompt) return Boolean(item.isMyApp);
      /*
       * Same ownership rule as prompts: a skill shared to the current user
       * with `WRITE` (`isEditable: true`) must not become re-shareable
       * merely from holding that permission — only the owner can share.
       */
      if (item.type === CatalogEntityType.Skill) return Boolean(item.isMyApp);
      if (item.type === CatalogEntityType.Toolset) {
        return isToolsetsSharingEnabled;
      }
      return isApplicationsSharingEnabled;
    },
    [isApplicationsSharingEnabled, isToolsetsSharingEnabled],
  );

  /*
   * Every catalog item type — prompts included — is visible for unsharing:
   * `DiscardSharedCatalogItemDto.itemId` now accepts a full `prompts/{bucket}/{path}`
   * resource path like any other entity type.
   */
  const isUnshareVisible = useCallback(() => true, []);

  /*
   * Every catalog item type — prompts included — is visible for revoking
   * share access: `RevokeSharedAccessDto.itemId` now accepts a full
   * `prompts/{bucket}/{path}` resource path like any other entity type.
   */
  const isRevokeShareVisible = useCallback(() => true, []);

  const handleUnshare = useCallback(
    async (item: CatalogItem) => {
      try {
        await discardSharedCatalogItem(item.id);
      } catch (err) {
        const { traceId } = await getApiErrorDetails(err);
        showErrorNotification({
          title: t(CatalogI18nKeys.DetailsUnshareErrorTitle),
          message: t(CatalogI18nKeys.DetailsUnshareError, { name: item.name }),
          requestId: traceId,
        });
        throw err;
      }

      try {
        if (item.type === CatalogEntityType.Toolset) {
          await refetchToolsets();
        } else if (item.type === CatalogEntityType.Skill) {
          await refetchSkills();
        } else if (item.type === CatalogEntityType.Prompt) {
          await refetchPrompts();
        } else {
          await refetchDeployments();
        }
      } catch {
        /*
         * The discard mutation has already succeeded. A refresh failure must
         * not turn that irreversible success into an actionable retry error;
         * the deployments context retains its own fetch error state.
         */
      }

      if (item.id === selectedItemId) {
        setSelectedItemId(null);
      }

      showSuccessNotification({
        title: t(CatalogI18nKeys.DetailsUnshareSuccessTitle),
        message: t(CatalogI18nKeys.DetailsUnshareSuccess, { name: item.name }),
      });
    },
    [
      refetchToolsets,
      refetchDeployments,
      refetchSkills,
      refetchPrompts,
      selectedItemId,
      setSelectedItemId,
      showSuccessNotification,
      showErrorNotification,
      t,
    ],
  );

  /*
   * Revoking removes every *recipient's* access; the item itself stays in the
   * owner's catalog, so — unlike `handleUnshare` — there is nothing to refetch
   * and no selection to clear.
   */
  const handleRevokeShare = useCallback(
    async (item: CatalogItem) => {
      try {
        await revokeSharedAccess(item.id);
      } catch (err) {
        const { traceId } = await getApiErrorDetails(err);
        showErrorNotification({
          title: t(CatalogI18nKeys.DetailsRevokeShareErrorTitle),
          message: t(CatalogI18nKeys.DetailsRevokeShareError, {
            name: item.name,
          }),
          requestId: traceId,
        });
        throw err;
      }

      showSuccessNotification({
        title: t(CatalogI18nKeys.DetailsRevokeShareSuccessTitle),
        message: t(CatalogI18nKeys.DetailsRevokeShareSuccess, {
          name: item.name,
        }),
      });
    },
    [showErrorNotification, showSuccessNotification, t],
  );

  /*
   * Resolved per item when the details panel's Manage menu opens, rather than
   * carried on the list items: the count only matters at the moment the owner
   * is about to act on it, and a snapshot taken at list-fetch time would still
   * offer "Revoke access (3)" right after those three grants were revoked.
   * A failure resolves to `undefined`, which keeps the action reachable
   * without a count instead of hiding the only way to revoke.
   */
  const handleFetchRecipientsCount = useCallback(async (item: CatalogItem) => {
    const { recipientsCount } = await getShareRecipientsCount(item.id);
    return recipientsCount;
  }, []);

  return {
    isShareVisible,
    isUnshareVisible,
    isRevokeShareVisible,
    handleUnshare,
    handleRevokeShare,
    handleFetchRecipientsCount,
  };
};

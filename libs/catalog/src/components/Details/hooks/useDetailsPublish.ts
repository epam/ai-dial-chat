import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { PublishHistoryEntry } from '@epam/ai-dial-publish-panel';
import {
  derivePublishState,
  PublishPanelView,
  usePublishFlow,
  usePublishFolderView,
} from '@epam/ai-dial-publish-panel';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import type { PublishedFolder } from '../../../models/details-panel';
import type { DetailsPanelProps } from '../../../models/item-details-props';
import {
  CATALOG_PUBLISH_ALLOWS_REPLACE,
  EMPTY_PUBLISH_FOLDERS,
  NO_OP_PUBLISH,
} from '../../../utils/details-panel';
import { canPublishCredentials } from '../../../utils/toolset-credentials';

/** Parameters for {@link useDetailsPublish}. */
export type UseDetailsPublishParams = Pick<
  DetailsPanelProps,
  | 'item'
  | 'isReadonly'
  | 'getPublishHistory'
  | 'publishFolderItems'
  | 'hasPublishWriteAccess'
  | 'publishDefaultAuthor'
  | 'onPublish'
  | 'onPublishSuccess'
  | 'onPublishError'
  | 'onCreatePublishFolder'
  | 'onFetchExistingRules'
  | 'onUnpublish'
  | 'isUnpublishVisible'
  | 'publishLabels'
>;

/** Publish sub-view state and the once-per-item publish-history lookup of the details panel. */
export const useDetailsPublish = ({
  item,
  isReadonly = false,
  getPublishHistory,
  publishFolderItems = EMPTY_PUBLISH_FOLDERS,
  hasPublishWriteAccess,
  publishDefaultAuthor,
  onPublish,
  onPublishSuccess,
  onPublishError,
  onCreatePublishFolder,
  onFetchExistingRules,
  onUnpublish,
  isUnpublishVisible,
  publishLabels,
}: UseDetailsPublishParams) => {
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [publishHistory, setPublishHistory] = useState<PublishHistoryEntry[]>(
    [],
  );
  /* Distinguishes "resolved, zero folders" from "not looked up yet" — the
   * Unpublish entry is withheld in the second case and hidden in the first. */
  const [isPublishHistoryResolved, setIsPublishHistoryResolved] =
    useState(false);
  const publishHistoryRequestedItemIdRef = useRef<string | null>(null);

  /*
   * Publish history is fetched at most once per item and shared by the publish
   * sub-view and the Manage menu's Unpublish gate, so opening Publish after
   * opening the menu issues no second request. For most items it is not
   * fetched on panel open or item render: most items are never unpublished,
   * and the request is only worth making when the user reaches for one of
   * those surfaces. The exception is an item the host has said is
   * unpublishable — see the effect after the per-item reset below.
   */
  const requestPublishHistory = useCallback(() => {
    if (
      !getPublishHistory ||
      publishHistoryRequestedItemIdRef.current === item.id
    ) {
      return;
    }
    const requestedItemId = item.id;
    publishHistoryRequestedItemIdRef.current = requestedItemId;

    const resolve = async () => {
      try {
        const entries = await getPublishHistory(item);
        if (publishHistoryRequestedItemIdRef.current !== requestedItemId)
          return;
        setPublishHistory(entries);
        setIsPublishHistoryResolved(true);
      } catch {
        if (publishHistoryRequestedItemIdRef.current !== requestedItemId)
          return;
        /* Cleared so the next Manage-menu or publish open retries the lookup.
         * Settled all the same, with no folder: the header holds its Manage
         * slot back until the lookup settles, so a failure left pending would
         * hide every other Manage entry along with Unpublish. */
        publishHistoryRequestedItemIdRef.current = null;
        setIsPublishHistoryResolved(true);
      }
    };
    void resolve();
  }, [getPublishHistory, item]);

  useEffect(() => {
    if (isPublishOpen) requestPublishHistory();
  }, [isPublishOpen, requestPublishHistory]);

  /*
   * A successful publish adds a folder to this item's history, so the
   * once-per-item lookup guard has to be released: without this the panel
   * keeps the pre-publish folder list, leaving the replace warning stale and
   * Unpublish hidden for the folder the user just published to.
   */
  const handlePublishSuccess = useCallback(
    (publishedItem: CatalogItem, folderPath: string[]) => {
      publishHistoryRequestedItemIdRef.current = null;
      setIsPublishHistoryResolved(false);
      requestPublishHistory();
      onPublishSuccess?.(publishedItem, folderPath);
    },
    [requestPublishHistory, onPublishSuccess],
  );

  const publishFlow = usePublishFlow<CatalogItem>({
    item,
    history: publishHistory,
    folderItems: publishFolderItems,
    hasWriteAccess: hasPublishWriteAccess,
    defaultAuthor: publishDefaultAuthor,
    onCreateFolder: onCreatePublishFolder,
    onPublish: onPublish ?? NO_OP_PUBLISH,
    onPublishSuccess: handlePublishSuccess,
    onPublishError,
    onFetchExistingRules,
  });

  /*
   * Offering the option is the catalog's call, not the panel's: only a toolset
   * that needs a login and whose publisher holds one can pass that access on.
   * `libs/publish-panel` renders whatever it is handed and knows none of this.
   */
  const isPublishCredentialsEligible =
    item.type === CatalogEntityType.Toolset &&
    canPublishCredentials(item.credentials);

  const publishDerived = useMemo(
    () =>
      derivePublishState({
        hasSelectedFolder: publishFlow.selectedFolderPath != null,
        hasExistingPublicationInFolder:
          publishFlow.hasExistingPublicationInFolder,
        hasWriteAccess: publishFlow.hasWriteAccess,
        isSubmitting: publishFlow.isSubmitting,
        hasSubmitError: publishFlow.hasSubmitError,
        allowReplace: CATALOG_PUBLISH_ALLOWS_REPLACE,
      }),
    [
      publishFlow.selectedFolderPath,
      publishFlow.hasExistingPublicationInFolder,
      publishFlow.hasWriteAccess,
      publishFlow.isSubmitting,
      publishFlow.hasSubmitError,
    ],
  );

  useEffect(() => {
    setIsPublishOpen(false);
    publishFlow.reset();
    setPublishHistory([]);
    setIsPublishHistoryResolved(false);
    publishHistoryRequestedItemIdRef.current = null;
    // Reset publish-flow-local state only when the displayed item changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  /*
   * An item the host affirmatively calls unpublishable — a published copy the
   * caller may remove — resolves its history up front. Whether "Unpublish"
   * joins the Manage menu decides whether the header shows a menu at all or
   * promotes a lone action to a button, and that decision has to be settled
   * before the pointer arrives rather than flip under it ([#8989](https://github.com/epam/ai-dial-chat/issues/8989), where an
   * Organization copy's only action sat behind `...`). Declared after the
   * reset above so a new item's request is not cleared in the same commit.
   */
  const shouldPrefetchPublishHistory =
    !isReadonly && !!onUnpublish && isUnpublishVisible?.(item) === true;

  useEffect(() => {
    if (shouldPrefetchPublishHistory) requestPublishHistory();
  }, [shouldPrefetchPublishHistory, requestPublishHistory]);

  /*
   * Deduplicated because history lists one entry per publication, and an
   * item republished to the same folder yields that folder twice. Order is
   * preserved, so the most recently published folder stays first. `key` is
   * the joined path, used for identity and display; `segments` is the
   * `string[]` shape `onUnpublish` is handed, matching `onPublish`.
   */
  const publishedFolders = useMemo(() => {
    const seen = new Set<string>();
    const folders: PublishedFolder[] = [];
    for (const entry of publishHistory) {
      const key = entry.folderPath.join('/');
      if (seen.has(key)) continue;
      seen.add(key);
      folders.push({ key, segments: entry.folderPath });
    }
    return folders;
  }, [publishHistory]);

  const hasPublishedFolders =
    isPublishHistoryResolved && publishedFolders.length > 0;

  /* The public root has no path segments, so it borrows the publish panel's
   * own root label rather than rendering as an empty string. */
  const formatFolderLabel = useCallback(
    (folderKey: string) =>
      folderKey || (publishLabels?.rootFolderLabel ?? 'Organization'),
    [publishLabels],
  );

  const handleOpenPublish = useCallback(() => setIsPublishOpen(true), []);
  const handleClosePublish = useCallback(() => {
    setIsPublishOpen(false);
    publishFlow.reset();
  }, [publishFlow]);
  const publishFolderView = usePublishFolderView({
    isOpen: isPublishOpen,
    selectedFolderPath: publishFlow.selectedFolderPath,
    onSelectedFolderPathChange: publishFlow.setSelectedFolderPath,
  });
  const isPublishFolderView =
    publishFolderView.view === PublishPanelView.ChangeFolder;
  const handleSubmitPublish = useCallback(async () => {
    const isSuccess = await publishFlow.handleSubmit();
    if (isSuccess) {
      handleClosePublish();
    }
  }, [publishFlow, handleClosePublish]);

  return {
    isPublishOpen,
    isPublishHistoryResolved,
    requestPublishHistory,
    publishFlow,
    isPublishCredentialsEligible,
    publishDerived,
    publishedFolders,
    hasPublishedFolders,
    formatFolderLabel,
    handleOpenPublish,
    handleClosePublish,
    publishFolderView,
    isPublishFolderView,
    handleSubmitPublish,
  };
};

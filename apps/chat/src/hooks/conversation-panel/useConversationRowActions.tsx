import {
  ConversationErrorCode,
  type DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import {
  deriveConversationRowActionState,
  createDeploymentLookup,
  getModelIdCandidatesFromConversationId,
  getApiErrorDetails,
  getConversationPath,
  useConversationLookupMaps,
  resolveConversationPinChange,
} from '@epam/ai-dial-chat-hooks';
import { ConversationExportMode } from '@epam/ai-dial-chat-hooks/conversation-transfer';
import {
  type ConversationItem,
  type ConversationMove,
} from '@epam/ai-dial-conversation-panel';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconCopy,
  IconDownload,
  IconPencilMinus,
  IconPin,
  IconPinnedFilled,
  IconShare,
  IconTrashX,
  IconUserOff,
  IconWorldOff,
  IconWorldShare,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { preloadPublishConversationPanel } from '../../components/PublishConversationPanelContainer/load-publish-conversation-panel';
import {
  getConversationRoute,
  normalizeConversationId,
} from '../../constants/routes';
import {
  ButtonsI18nKeys,
  ConversationExportI18nKeys,
  ConversationPanelI18nKeys,
} from '../../constants/translation-keys';
import { useConversations } from '../../context/ConversationsContext';
import { useNotification } from '../../context/NotificationContext';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { PublishHistoryStatus } from '../../types/publish-history';
import { conversationIdsMatch } from '../../utils/conversation-id-match';
import type { useConversationEditDialogs } from './useConversationEditDialogs';
import type { useConversationSharingDialogs } from './useConversationSharingDialogs';
import type { useConversationTransfer } from './useConversationTransfer';

type EditDialogs = ReturnType<typeof useConversationEditDialogs>;

type SharingDialogs = ReturnType<typeof useConversationSharingDialogs>;

type LookupMaps = ReturnType<typeof useConversationLookupMaps>;

interface UseConversationRowActionsParams {
  panelActiveConversationId: string | undefined;
  conversations: ConversationItem[];
  toContextId: LookupMaps['toContextId'];
  getRawItem: LookupMaps['getRawItem'];
  findDeployment: ReturnType<typeof createDeploymentLookup>;
  selectedItemId: string | null | undefined;
  isConversationsSharingEnabled: boolean;
  isConversationsPublishingEnabled: boolean;
  isConversationExportHidden: boolean;
  onDuplicateReadonly: (() => void) | undefined;
  exportSingle: ReturnType<typeof useConversationTransfer>['exportSingle'];
  openDeleteDialog: EditDialogs['openDeleteDialog'];
  openRenameDialog: EditDialogs['openRenameDialog'];
  openUnshareDialog: SharingDialogs['openUnshareDialog'];
  openRevokeDialog: SharingDialogs['openRevokeDialog'];
  openUnpublishDialog: SharingDialogs['openUnpublishDialog'];
  setPendingShareConversationPath: SharingDialogs['setPendingShareConversationPath'];
  setPendingPublishConversation: SharingDialogs['setPendingPublishConversation'];
  requestRecipientsCount: SharingDialogs['requestRecipientsCount'];
  getRecipientsCount: SharingDialogs['getRecipientsCount'];
  requestPublishHistory: SharingDialogs['requestPublishHistory'];
  getPublishHistory: SharingDialogs['getPublishHistory'];
}

/**
 * The conversation panel's row actions: `getActions` (each row's action
 * menu), the menu-open prefetch of recipient counts and publish history,
 * and pin/unpin on drag. `getActions` reads the active conversation through
 * a ref so its identity survives navigation and the memoized panel does not
 * rebuild every row's menu. Reads the conversations, navigation,
 * notification and i18n contexts itself.
 */
export const useConversationRowActions = ({
  panelActiveConversationId,
  conversations,
  toContextId,
  getRawItem,
  findDeployment,
  selectedItemId,
  isConversationsSharingEnabled,
  isConversationsPublishingEnabled,
  isConversationExportHidden,
  onDuplicateReadonly,
  exportSingle,
  openDeleteDialog,
  openRenameDialog,
  openUnshareDialog,
  openRevokeDialog,
  openUnpublishDialog,
  setPendingShareConversationPath,
  setPendingPublishConversation,
  requestRecipientsCount,
  getRecipientsCount,
  requestPublishHistory,
  getPublishHistory,
}: UseConversationRowActionsParams) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showErrorNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();
  const { pinConversation, duplicateConversation } = useConversations();

  /* Read by row actions at click time, so `getActions` keeps its identity
   across navigation and the panel does not rebuild every row's menu. */
  const panelActiveConversationIdRef = useRef(panelActiveConversationId);
  useEffect(() => {
    panelActiveConversationIdRef.current = panelActiveConversationId;
  }, [panelActiveConversationId]);

  /*
   * The row's kebab trigger, captured whenever its menu opens. Every overlay
   * launched from that menu returns focus here on close: the menu item that
   * was actually clicked unmounts with the menu, so it is not a target a
   * closing dialog can restore focus to.
   */
  const rowActionsTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleMoveConversation = useCallback(
    ({ draggedId, targetGroupKey }: ConversationMove) => {
      const contextId = toContextId(draggedId);
      if (!contextId) return;

      const draggedItem = conversations.find((c) => c.id === draggedId);
      if (!draggedItem) return;

      const pinned = resolveConversationPinChange(
        targetGroupKey,
        draggedItem.isPinned,
      );
      if (pinned != null) void pinConversation(contextId, pinned);
    },
    [toContextId, conversations, pinConversation],
  );

  /*
   * The row's recipient count is fetched here rather than carried on the list
   * items: it only matters at the moment the owner is about to act on it, and a
   * snapshot from the list fetch would still offer "Revoke access (3)" right
   * after those three grants were revoked.
   */
  const handleActionMenuOpen = useCallback(
    (item: ConversationItem, trigger: HTMLButtonElement) => {
      rowActionsTriggerRef.current = trigger;

      const contextId = toContextId(item.id);
      if (!contextId) return;

      /* Only an owned, writable row can offer revoking or unpublishing, so
       * only those need either lookup. */
      const rawItem = getRawItem(item.id);
      if (
        rawItem?.isReadonly ||
        rawItem?.sharedWithMe ||
        rawItem?.publishedWithMe
      ) {
        return;
      }
      if (isConversationsSharingEnabled) {
        requestRecipientsCount(contextId);
      }
      /*
       * Keyed by the same bucket-relative path the publish and unpublish
       * requests use, so the publish panel opened next reuses this result.
       */
      if (isConversationsPublishingEnabled) {
        requestPublishHistory(
          getConversationPath(normalizeConversationId(contextId)),
        );
        // The panel renders without a loading fallback, so fetch its chunk before Publish is picked.
        preloadPublishConversationPanel();
      }
    },
    [
      toContextId,
      getRawItem,
      isConversationsSharingEnabled,
      isConversationsPublishingEnabled,
      requestRecipientsCount,
      requestPublishHistory,
    ],
  );

  const getActions = useCallback(
    (panelItem: ConversationItem): DropdownItem[] => {
      const contextId = toContextId(panelItem.id);
      if (!contextId) return [];

      const rawItem = getRawItem(panelItem.id);
      const conversationPath = getConversationPath(
        normalizeConversationId(contextId),
      );
      const history = getPublishHistory(conversationPath);
      const recipients = getRecipientsCount(contextId);
      /*
       * A duplicate, share link or published copy would put a model hidden
       * via HIDDEN_ENTITY_TAGS back to work, so a row on one offers none of
       * them ([#9183](https://github.com/epam/ai-dial-chat/issues/9183)).
       * The path only records the model a conversation was created with; for
       * the open one the picker's selection is the model it uses now, so a
       * conversation switched onto (or off) a hidden model is judged by that.
       * Other rows fall back to the path, and the backend refuses the rest.
       */
      const activeIdAtRender = panelActiveConversationIdRef.current;
      const isActiveRow =
        activeIdAtRender != null &&
        conversationIdsMatch(panelItem.id, activeIdAtRender);
      let rowDeployment: DeploymentItemDto | undefined;
      if (isActiveRow && selectedItemId) {
        rowDeployment = findDeployment(selectedItemId);
      } else {
        for (const candidate of getModelIdCandidatesFromConversationId(
          contextId,
        )) {
          rowDeployment = findDeployment(candidate);
          if (rowDeployment) break;
        }
      }
      const isModelHidden = !!rowDeployment?.isHidden;

      const {
        isReadonly: isReadonlyItem,
        publishedFolders,
        isRevokeVisible,
      } = deriveConversationRowActionState(
        {
          sharedWithMe: rawItem?.sharedWithMe ?? false,
          publishedWithMe: rawItem?.publishedWithMe ?? false,
          isReadonly: rawItem?.isReadonly ?? false,
        },
        history.status === PublishHistoryStatus.Resolved
          ? history.entries
          : undefined,
        recipients,
      );

      const pinAction: DropdownItem = {
        key: 'pin',
        label: panelItem.isPinned
          ? t(ButtonsI18nKeys.Unpin)
          : t(ButtonsI18nKeys.Pin),
        icon: panelItem.isPinned ? (
          <IconPinnedFilled
            size={DIAL_ICON_SIZE.MD}
            className="text-secondary"
          />
        ) : (
          <IconPin
            size={DIAL_ICON_SIZE.MD}
            className="text-secondary"
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        onClick: () => pinConversation(contextId, !panelItem.isPinned),
      };

      const duplicateAction: DropdownItem = {
        key: 'duplicate',
        label: t(ButtonsI18nKeys.Duplicate),
        icon: (
          <IconCopy
            size={DIAL_ICON_SIZE.MD}
            className="text-secondary"
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        onClick: async () => {
          const activeIdAtClick = panelActiveConversationIdRef.current;
          try {
            const newPath = await duplicateConversation(contextId);
            if (
              isReadonlyItem &&
              activeIdAtClick &&
              conversationIdsMatch(panelItem.id, activeIdAtClick)
            ) {
              onDuplicateReadonly?.();
            }
            notifyOperationSuccess(
              NotifiableEntity.Conversation,
              EntityOperation.Duplicated,
              { name: panelItem.title },
            );
            navigate(getConversationRoute(newPath));
          } catch (error) {
            const { traceId, code } = await getApiErrorDetails(error);
            /* The row only knows the model from the path, which keeps the
             model the chat was created with; the server checks the model
             it uses now and refuses a hidden one (#9183). */
            showErrorNotification({
              message: t(
                code === ConversationErrorCode.ConversationDuplicateModelHidden
                  ? ConversationPanelI18nKeys.DuplicateUnavailableModel
                  : ConversationPanelI18nKeys.DuplicateError,
              ),
              requestId: traceId,
            });
          }
        },
      };

      const startExport = (mode: ConversationExportMode) => {
        void exportSingle(contextId, panelItem.title, mode);
      };

      const exportAction: DropdownItem = {
        key: 'export',
        label: t(ConversationExportI18nKeys.ExportLabel),
        icon: (
          <IconDownload
            size={DIAL_ICON_SIZE.MD}
            className="text-secondary"
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        children: [
          {
            key: 'export-with-attachments',
            label: t(ConversationExportI18nKeys.WithAttachmentsOption),
            onClick: () => startExport(ConversationExportMode.WithAttachments),
          },
          {
            key: 'export-without-attachments',
            label: t(ConversationExportI18nKeys.WithoutAttachmentsOption),
            onClick: () =>
              startExport(ConversationExportMode.WithoutAttachments),
          },
        ],
      };

      const exportActions = isConversationExportHidden ? [] : [exportAction];
      const duplicateActions = isModelHidden ? [] : [duplicateAction];

      if (isReadonlyItem) {
        const readonlyActions = [
          pinAction,
          ...duplicateActions,
          ...exportActions,
        ];
        if (rawItem?.sharedWithMe) {
          readonlyActions.push({
            key: 'unshare',
            label: t(ButtonsI18nKeys.RemoveFromMyList),
            icon: (
              <IconTrashX
                size={DIAL_ICON_SIZE.MD}
                stroke={DIAL_KIT_ICON_STROKE}
              />
            ),
            onClick: () =>
              openUnshareDialog(contextId, rowActionsTriggerRef.current),
          });
        }
        return readonlyActions;
      }

      return [
        pinAction,
        {
          key: 'rename',
          label: t(ButtonsI18nKeys.Rename),
          icon: (
            <IconPencilMinus
              size={DIAL_ICON_SIZE.MD}
              className="text-secondary"
              stroke={DIAL_KIT_ICON_STROKE}
            />
          ),
          onClick: () =>
            openRenameDialog(
              { id: contextId, title: panelItem.title },
              rowActionsTriggerRef.current,
            ),
        },
        ...duplicateActions,
        ...exportActions,
        ...(isConversationsSharingEnabled && !isModelHidden
          ? [
              {
                key: 'share',
                label: t(ButtonsI18nKeys.Share),
                icon: (
                  <IconShare
                    size={DIAL_ICON_SIZE.MD}
                    className="text-secondary"
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                ),
                onClick: () => setPendingShareConversationPath(contextId),
              },
            ]
          : []),
        /*
         * "Publish" and "Unpublish" are mutually exclusive: the row menu offers
         * whichever one matches the conversation's current state, never both.
         * A conversation with no published copy offers "Publish"; once history
         * resolves to at least one published folder, "Unpublish" takes its
         * place. Republishing an already-published conversation therefore means
         * unpublishing it first — the trade the single-state menu buys.
         */
        ...(isConversationsPublishingEnabled &&
        publishedFolders.length === 0 &&
        !isModelHidden
          ? [
              {
                key: 'publish',
                label: t(ButtonsI18nKeys.Publish),
                icon: (
                  <IconWorldShare
                    size={DIAL_ICON_SIZE.MD}
                    className="text-secondary"
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                ),
                /*
                 * Unlike Share's itemId (which wants the full `conversations/{bucket}/{name}`
                 * resource path), the publish endpoint's `path` query param follows the
                 * rename/delete/duplicate convention — bucket-relative, no `conversations/`
                 * prefix — so it must be stripped here (see conversation-publish.service.ts).
                 */
                onClick: () =>
                  setPendingPublishConversation({
                    path: getConversationPath(
                      normalizeConversationId(contextId),
                    ),
                    title: panelItem.title,
                  }),
              },
            ]
          : []),
        /*
         * Withheld until the publish-history lookup started by this menu's
         * open settles, and hidden on zero folders or on failure: unpublish
         * needs the folder itself to build the request, so an entry shown
         * without one could not do anything if clicked. While it is withheld
         * "Publish" holds the slot, so the menu can swap one for the other as
         * the lookup lands.
         */
        ...(isConversationsPublishingEnabled && publishedFolders.length > 0
          ? [
              {
                key: 'unpublish',
                label: t(ButtonsI18nKeys.Unpublish),
                icon: (
                  <IconWorldOff
                    size={DIAL_ICON_SIZE.MD}
                    aria-hidden
                    className="text-secondary"
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                ),
                onClick: () => {
                  openUnpublishDialog(
                    {
                      path: conversationPath,
                      name: panelItem.title,
                      folders: publishedFolders,
                    },
                    rowActionsTriggerRef.current,
                  );
                },
              },
            ]
          : []),
        /*
         * Revoking cuts off every recipient of an owned conversation. It rides
         * the same feature flag as Share: with sharing disabled there is no way
         * to grant access, so offering to revoke it would be incoherent.
         *
         * The recipient count is requested when this menu opens, so it is never
         * a stale list snapshot. The entry is withheld until the lookup settles
         * and stays hidden once nobody holds access; a lookup that could not
         * produce a number still shows it, so a transient failure never removes
         * the only way to revoke.
         */
        ...(isConversationsSharingEnabled && isRevokeVisible
          ? [
              {
                key: 'revoke-access',
                label:
                  recipients.count == null
                    ? t(ButtonsI18nKeys.RevokeAccess)
                    : t(ButtonsI18nKeys.RevokeAccessWithCount, {
                        count: recipients.count,
                      }),
                icon: (
                  <IconUserOff
                    size={DIAL_ICON_SIZE.MD}
                    className="text-secondary"
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                ),
                onClick: () =>
                  openRevokeDialog(contextId, rowActionsTriggerRef.current),
              },
            ]
          : []),
        {
          key: 'delete',
          label: t(ButtonsI18nKeys.Delete),
          icon: (
            <IconTrashX
              size={DIAL_ICON_SIZE.MD}
              className="text-error"
              stroke={DIAL_KIT_ICON_STROKE}
            />
          ),
          className: 'text-error',
          onClick: () =>
            openDeleteDialog(contextId, rowActionsTriggerRef.current),
        },
      ];
    },
    [
      toContextId,
      getRawItem,
      findDeployment,
      selectedItemId,
      t,
      pinConversation,
      duplicateConversation,
      isConversationsSharingEnabled,
      isConversationsPublishingEnabled,
      isConversationExportHidden,
      getPublishHistory,
      navigate,
      onDuplicateReadonly,
      notifyOperationSuccess,
      showErrorNotification,
      exportSingle,
      getRecipientsCount,
      openDeleteDialog,
      openUnshareDialog,
      openRevokeDialog,
      openRenameDialog,
      openUnpublishDialog,
      setPendingShareConversationPath,
      setPendingPublishConversation,
    ],
  );

  return {
    rowActionsTriggerRef,
    handleMoveConversation,
    handleActionMenuOpen,
    getActions,
  };
};

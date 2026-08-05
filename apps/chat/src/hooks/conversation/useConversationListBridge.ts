import type {
  CreateConversationResponse,
  DeleteConversationResponse,
  OverlayConversation,
  OverlayConversationError,
  RenameConversationResponse,
  SelectConversationResponse,
} from '@epam/ai-dial-chat-overlay';
import type {
  ConversationListItemDto,
  ConversationResponseDto,
} from '@epam/chat-api-client';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getConversationRoute } from '../../constants/routes';
import { useConversations } from '../../context/ConversationsContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import {
  getApiErrorMessage,
  getApiErrorStatus,
} from '../../server-api/api-error';
import {
  createConversation as apiCreateConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { ROUTES } from '../../types/routes';
import { conversationIdsMatch } from '../../utils/conversation-id-match';
import { getConversationPath } from '../../utils/conversation-path';

const toOverlayConversation = (
  item: ConversationListItemDto,
): OverlayConversation => ({
  id: item.id,
  title: item.title,
  updatedAt: item.updatedAt,
  isPinned: item.isPinned,
  isReadonly: item.isReadonly,
  sharedWithMe: item.sharedWithMe,
  publishedWithMe: item.publishedWithMe,
});

const mapToOverlayConversationError = async (
  error: unknown,
  fallbackMessage: string,
): Promise<OverlayConversationError> => {
  const status = getApiErrorStatus(error);
  const message = (await getApiErrorMessage(error)) ?? fallbackMessage;
  if (status === 403 || status === 401) {
    return { code: 'FORBIDDEN', message };
  }
  if (status === 400 || status === 409 || status === 422) {
    return { code: 'INVALID_ARGUMENT', message };
  }
  return { code: 'NOT_FOUND', message };
};

/**
 * Registers the app-side conversation-list bridge backing the overlay's
 * getConversations/createConversation/deleteConversation/renameConversation/
 * selectConversation methods, composing `ConversationsContext`/
 * `DeploymentsContext`/navigation. Mounted once inside `App`, below
 * `ConversationsProvider`/`DeploymentsProvider` (where both are reachable).
 * No-op outside overlay mode.
 */
export const useConversationListBridge = (): void => {
  const overlay = useOptionalOverlay();
  const navigate = useNavigate();
  const {
    conversations,
    deleteConversation,
    renameConversation,
    refreshConversations,
  } = useConversations();
  const { selectedItemId } = useDeployments();

  useEffect(() => {
    if (!overlay) return;

    overlay.registerConversationListBridge({
      getConversations: () => conversations.map(toOverlayConversation),

      createConversation: async ({
        deploymentId,
        firstMessage,
      }): Promise<CreateConversationResponse> => {
        const trimmedMessage = firstMessage?.trim();
        if (!trimmedMessage) {
          navigate(ROUTES.Root, {
            state: deploymentId ? { deploymentId } : null,
          });
          return { conversation: null };
        }

        const resolvedDeploymentId = deploymentId ?? selectedItemId;
        if (!resolvedDeploymentId) {
          return {
            conversation: null,
            error: {
              code: 'INVALID_ARGUMENT',
              message:
                'No deployment is available to create a conversation with.',
            },
          };
        }

        try {
          const created = (await apiCreateConversation(
            trimmedMessage,
            resolvedDeploymentId,
          )) as ConversationResponseDto;
          await saveConversation(getConversationPath(created.id), created);
          navigate(getConversationRoute(created.id), {
            state: { conversation: created },
          });
          void refreshConversations();
          return {
            conversation: {
              id: created.id,
              title: created.name,
              updatedAt: created.updatedAt,
              isPinned: false,
              isReadonly: false,
              sharedWithMe: false,
              publishedWithMe: false,
            },
          };
        } catch (error) {
          return {
            conversation: null,
            error: await mapToOverlayConversationError(
              error,
              'Failed to create conversation.',
            ),
          };
        }
      },

      deleteConversation: async (id): Promise<DeleteConversationResponse> => {
        try {
          await deleteConversation(id);
          return {};
        } catch (error) {
          return {
            error: await mapToOverlayConversationError(
              error,
              'Failed to delete conversation.',
            ),
          };
        }
      },

      renameConversation: async (
        id,
        newName,
      ): Promise<RenameConversationResponse> => {
        if (!newName.trim()) {
          return {
            error: {
              code: 'INVALID_ARGUMENT',
              message: 'Conversation name must not be blank.',
            },
          };
        }
        try {
          await renameConversation(id, newName);
          const existing = conversations.find((item) =>
            conversationIdsMatch(item.id, id),
          );
          return {
            conversation: existing
              ? toOverlayConversation({ ...existing, title: newName })
              : {
                  id,
                  title: newName,
                  updatedAt: Date.now(),
                  isPinned: false,
                  isReadonly: false,
                  sharedWithMe: false,
                  publishedWithMe: false,
                },
          };
        } catch (error) {
          return {
            error: await mapToOverlayConversationError(
              error,
              'Failed to rename conversation.',
            ),
          };
        }
      },

      selectConversation: (id): Promise<SelectConversationResponse> => {
        navigate(getConversationRoute(id));
        return Promise.resolve({});
      },
    });

    return () => overlay.registerConversationListBridge(null);
  }, [
    overlay,
    conversations,
    navigate,
    selectedItemId,
    deleteConversation,
    renameConversation,
    refreshConversations,
  ]);
};

import type {
  ConversationResponseDto,
  ConversationsApi,
} from '@epam/ai-dial-chat-api-client';
import {
  createChatStreamApi,
  getBrowserTimezone,
  type ConversationStreamTransport,
} from '@epam/ai-dial-chat-hooks';
import type { Conversation } from '@epam/ai-dial-chat-shared';
import {
  getProjectConversationRoute,
  getProjectViewRoute,
} from '../constants/routes';
import { ProjectsI18nKeys } from '../constants/translation-keys';
import type { ConversationDataSource } from '../models/conversation-data-source';
import { ApiEndpoints, getCsrfToken, setCsrfToken } from '../server-api/base';
import {
  attachToProjectGeneration,
  deleteProjectConversation,
  getProjectConversation,
  saveProjectConversation,
} from '../server-api/project-conversations.api';
import { NO_CONVERSATION_LIST_SYNC } from './regular-conversation-data-source';

const PROJECTS_PREFIX = 'projects/';
/* Re-reads of a project conversation after its first reply, waiting the delay list discovery uses. */
const TITLE_READ_ATTEMPTS = 5;
const TITLE_READ_DELAY_MS = 2_000;
/* Re-read interval of a generation resumed without attach. */
const WATCH_POLL_INTERVAL_MS = 5_000;
const WATCH_UPDATE_FRAME = 'data: {"action":"UPDATE"}\n\n';

/* A stream path is the conversation id without `projects/`. */
const toConversationId = (path: string): string =>
  path.startsWith(PROJECTS_PREFIX) ? path : `${PROJECTS_PREFIX}${path}`;

const waitFor = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/**
 * The resource-update stream of a project conversation. Core resource
 * subscriptions inside a project are not available, so it emits a synthetic
 * `UPDATE` event every `WATCH_POLL_INTERVAL_MS`, and the resume re-reads the
 * conversation on each, until `signal` aborts. The stream only produces an
 * event when it is read, so a released reader stops the polling.
 */
const watchProjectConversation = (
  signal: AbortSignal,
): ReadableStream<Uint8Array> => {
  const updateFrame = new TextEncoder().encode(WATCH_UPDATE_FRAME);
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        await waitFor(WATCH_POLL_INTERVAL_MS, signal);
        if (signal.aborted) {
          controller.close();
          return;
        }
        controller.enqueue(updateFrame);
      },
    },
    { highWaterMark: 0 },
  );
};

/**
 * Watches a project conversation for the title its first reply produces.
 * Core resource subscriptions inside a project are not available, so it
 * re-reads the conversation a few times instead. Returns a cleanup.
 */
const watchProjectConversationTitle = (
  conversationId: string,
  previousName: string,
  onUpdated: (title: string) => void,
): (() => void) => {
  const controller = new AbortController();
  const run = async () => {
    for (let attempt = 0; attempt < TITLE_READ_ATTEMPTS; attempt++) {
      await waitFor(TITLE_READ_DELAY_MS, controller.signal);
      if (controller.signal.aborted) return;
      try {
        const { name } = await getProjectConversation(
          conversationId,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (name && name !== previousName) {
          onUpdated(name);
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
      }
    }
  };
  void run();
  return () => controller.abort();
};

/**
 * The data source of a conversation stored inside a project: the project
 * conversation endpoints for loads, saves and streams, the project's routes,
 * read-only from `canEdit`, and no sidebar list side effects or Duplicate.
 */
export const createProjectConversationDataSource = ({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}): ConversationDataSource => {
  const { streamCompletion, stopCompletion } = createChatStreamApi({
    getCsrfToken,
    setCsrfToken,
    completionsBasePath: `${ApiEndpoints.PROJECTS}/${encodeURIComponent(projectId)}/conversations`,
    getTimezone: getBrowserTimezone,
  });
  const saveConversation = (
    path: string,
    conversation: ConversationResponseDto,
  ) => saveProjectConversation(toConversationId(path), conversation);
  const transport: ConversationStreamTransport = {
    streamCompletion,
    stopCompletion,
    watchConversation: async (_path, signal) =>
      watchProjectConversation(signal),
    attachToGeneration: (path, signal) =>
      attachToProjectGeneration(projectId, path, signal),
    getConversation: async (conversationId, signal) =>
      (await getProjectConversation(conversationId, signal)) as Conversation,
    saveConversation: async (path, conversation) =>
      (await saveConversation(
        path,
        conversation as unknown as ConversationResponseDto,
      )) as Conversation,
  };
  const handlersApi = {
    saveConversation: ({ path, saveConversationBodyDto }) =>
      saveConversation(path, saveConversationBodyDto.conversation),
    deleteConversation: ({ path }) =>
      deleteProjectConversation(toConversationId(path)),
  } satisfies Pick<ConversationsApi, 'saveConversation' | 'deleteConversation'>;

  return {
    transport,
    getConversation: getProjectConversation,
    saveConversation,
    handlersApi,
    watchTitle: watchProjectConversationTitle,
    getConversationRoute: getProjectConversationRoute,
    getExitRoute: () => getProjectViewRoute(projectId),
    isReadOnly: () => !canEdit,
    listSync: NO_CONVERSATION_LIST_SYNC,
    canDuplicate: false,
    notFoundMessageKey: ProjectsI18nKeys.ChatNotFound,
  };
};

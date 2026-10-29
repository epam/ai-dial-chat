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

const PROJECTS_PREFIX = 'projects/';
/* Re-reads of a project conversation after its first reply, waiting the delay list discovery uses. */
const TITLE_READ_ATTEMPTS = 5;
const TITLE_READ_DELAY_MS = 2_000;

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
    // TEMP: remove after the project-chat latency investigation.
    streamCompletion: async (...args: Parameters<typeof streamCompletion>) => {
      const startedAt = performance.now();
      console.warn('[TEMP project-chat-latency] completion request sent');
      const stream = await streamCompletion(...args);
      console.warn(
        `[TEMP project-chat-latency] completion response after ${Math.round(performance.now() - startedAt)} ms`,
      );
      return stream;
    },
    stopCompletion,
    /* No resource subscription exists for a file inside a project: an already-closed stream. */
    watchConversation: async () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      }),
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
  } as Pick<ConversationsApi, 'saveConversation' | 'deleteConversation'>;

  return {
    transport,
    getConversation: getProjectConversation,
    saveConversation,
    handlersApi,
    watchTitle: watchProjectConversationTitle,
    getConversationRoute: getProjectConversationRoute,
    getExitRoute: () => getProjectViewRoute(projectId),
    isReadOnly: () => !canEdit,
    listSync: null,
    canDuplicate: false,
    notFoundMessageKey: ProjectsI18nKeys.ChatNotFound,
  };
};

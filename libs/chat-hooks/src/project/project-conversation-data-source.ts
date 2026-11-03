import type {
  ConversationResponseDto,
  ConversationsApi,
} from '@epam/ai-dial-chat-api-client';
import type { Conversation } from '@epam/ai-dial-chat-shared';
import {
  NO_CONVERSATION_LIST_SYNC,
  type ConversationDataSource,
  type ConversationListSync,
} from '../conversation/conversation-data-source';
import {
  createChatStreamApi,
  type CreateChatStreamApiDeps,
} from '../conversation/create-chat-stream-api';
import type { ConversationStreamTransport } from '../conversation/useConversationStream/useConversationStream';
import { getBrowserTimezone } from '../shared/browser-timezone';
import type { SerializedKeyedWriter } from '../shared/serialized-writer';
import { sleep } from '../shared/sleep';
import type { ProjectsApiClient } from './projects-api-client';

const PROJECTS_PREFIX = 'projects/';
/* Re-reads of a project conversation after its first reply, waiting the delay list discovery uses. */
const TITLE_READ_ATTEMPTS = 5;
const TITLE_READ_DELAY_MS = 2_000;
/* Re-read interval of a generation resumed without attach. */
const WATCH_POLL_INTERVAL_MS = 5_000;
const WATCH_UPDATE_FRAME = 'data: {"action":"UPDATE"}\n\n';

/** Host ports of {@link createProjectConversationDataSource}. */
export interface ProjectConversationDataSourceOptions {
  /** The project's DIAL id. */
  projectId: string;
  /** Whether the caller owns the project; a conversation opens read-only without it. */
  canEdit: boolean;
  /** Configured project requests, from `createProjectsApiClient`; only the conversation requests are used. */
  client: Pick<
    ProjectsApiClient,
    | 'getProjectConversation'
    | 'saveProjectConversation'
    | 'deleteProjectConversation'
    | 'attachToProjectGeneration'
  >;
  /** Where and how the completion stream is sent: the host's base path under the project, and its CSRF token store. */
  stream: Pick<
    CreateChatStreamApiDeps,
    'getCsrfToken' | 'setCsrfToken' | 'completionsBasePath'
  >;
  /** The host's routes: a project conversation's page, and where a deleted or missing one goes. */
  routes: {
    /** Returns the page route of a conversation. */
    getConversationRoute: (id: string) => string;
    /** Returns the route a deleted or missing conversation navigates to. */
    getExitRoute: () => string;
  };
  /** The queue viewed marks go through, shared with the host's other pages so they write one at a time. */
  viewedWriter: SerializedKeyedWriter;
  /** Translation key of the toast shown when the conversation cannot be loaded; the host resolves it. */
  notFoundMessageKey?: string;
}

/* A stream path is the conversation id without `projects/`. */
const toConversationId = (path: string): string =>
  path.startsWith(PROJECTS_PREFIX) ? path : `${PROJECTS_PREFIX}${path}`;

/*
 * Core resource subscriptions inside a project are not available, so the
 * watch emits a synthetic `UPDATE` event every `WATCH_POLL_INTERVAL_MS`, and
 * the resume re-reads the conversation on each, until `signal` aborts. The
 * stream only produces an event when it is read, so a released reader stops the
 * polling.
 */
const watchProjectConversation = (
  signal: AbortSignal,
): ReadableStream<Uint8Array> => {
  const updateFrame = new TextEncoder().encode(WATCH_UPDATE_FRAME);
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        await sleep(WATCH_POLL_INTERVAL_MS, signal);
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

/*
 * Core resource subscriptions inside a project are not available, so the
 * title its first reply produces is found by re-reading the conversation a few
 * times. Returns a cleanup.
 */
const watchProjectConversationTitle = (
  readConversation: (
    conversationId: string,
    signal: AbortSignal,
  ) => Promise<ConversationResponseDto>,
  conversationId: string,
  previousName: string,
  onUpdated: (title: string) => void,
): (() => void) => {
  const controller = new AbortController();
  const run = async () => {
    for (let attempt = 0; attempt < TITLE_READ_ATTEMPTS; attempt++) {
      await sleep(TITLE_READ_DELAY_MS, controller.signal);
      if (controller.signal.aborted) return;
      try {
        const { name } = await readConversation(
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
 * Returns the data source of a conversation stored inside a project: the
 * project conversation requests for loads, saves and streams, the host's
 * routes, read-only from `canEdit`, no sidebar list side effects and no
 * Duplicate. A project chat has no sidebar row, so the open chat is marked
 * viewed through `viewedWriter`, and a generation starting drops a mark still
 * waiting for its chat.
 */
export const createProjectConversationDataSource = ({
  projectId,
  canEdit,
  client,
  stream,
  routes,
  viewedWriter,
  notFoundMessageKey,
}: ProjectConversationDataSourceOptions): ConversationDataSource => {
  const { streamCompletion, stopCompletion } = createChatStreamApi({
    ...stream,
    getTimezone: getBrowserTimezone,
  });
  const listSync: ConversationListSync = {
    ...NO_CONVERSATION_LIST_SYNC,
    markUnread: (id) => viewedWriter.drop(id),
    markViewed: async (id) => {
      try {
        await viewedWriter.enqueue(id);
      } catch {
        /* The next open or finished generation marks it again. */
      }
    },
    shouldMarkOpenChatViewed: true,
  };
  const saveConversation = (
    path: string,
    conversation: ConversationResponseDto,
  ) => client.saveProjectConversation(toConversationId(path), conversation);
  const transport: ConversationStreamTransport = {
    streamCompletion,
    stopCompletion,
    watchConversation: async (_path, signal) =>
      watchProjectConversation(signal),
    attachToGeneration: (path, signal) =>
      client.attachToProjectGeneration(projectId, path, signal),
    getConversation: async (conversationId, signal) =>
      (await client.getProjectConversation(
        conversationId,
        signal,
      )) as Conversation,
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
      client.deleteProjectConversation(toConversationId(path)),
  } satisfies Pick<ConversationsApi, 'saveConversation' | 'deleteConversation'>;

  return {
    transport,
    getConversation: client.getProjectConversation,
    saveConversation,
    handlersApi,
    watchTitle: (conversationId, previousName, onUpdated) =>
      watchProjectConversationTitle(
        client.getProjectConversation,
        conversationId,
        previousName,
        onUpdated,
      ),
    getConversationRoute: routes.getConversationRoute,
    getExitRoute: routes.getExitRoute,
    isReadOnly: () => !canEdit,
    listSync,
    canDuplicate: false,
    notFoundMessageKey,
  };
};

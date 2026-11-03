import {
  ResponseError,
  type ConversationResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { ResponseFormat } from '@epam/ai-dial-chat-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyProjectChatCreateError,
  createProjectChat,
  ProjectChatCreateFailure,
} from '../create-project-chat';

const PROJECT_ID = 'projects/a1b2c3/q4';
const CREATED = {
  id: `${PROJECT_ID}/conversations/gpt-4o__Draft__1`,
  name: 'gpt-4o__Draft__1',
} as ConversationResponseDto;
const REQUEST = {
  firstMessage: 'Draft an article',
  deploymentId: 'gpt-4o',
  configurationValue: { tool: true },
};
const SETTINGS = {
  systemPrompt: 'Be brief',
  temperature: 0.5,
  responseFormat: ResponseFormat.Markdown,
};

const client = {
  createProjectConversation: vi.fn(),
  saveProjectConversation: vi.fn(),
};
const onCreated = vi.fn();

const rejection = (status: number, body: unknown = {}) =>
  new ResponseError(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

describe('createProjectChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.createProjectConversation.mockResolvedValue(CREATED);
    client.saveProjectConversation.mockResolvedValue(CREATED);
  });

  it('creates the chat from the first message, saves the composer settings and hands the saved chat over', async () => {
    const saved = await createProjectChat(
      client,
      PROJECT_ID,
      REQUEST,
      SETTINGS,
      onCreated,
    );

    expect(client.createProjectConversation).toHaveBeenCalledWith(
      PROJECT_ID,
      REQUEST,
    );
    const expected = {
      ...CREATED,
      prompt: 'Be brief',
      temperature: 0.5,
      responseFormat: ResponseFormat.Markdown,
    };
    expect(client.saveProjectConversation).toHaveBeenCalledWith(
      CREATED.id,
      expected,
    );
    expect(onCreated).toHaveBeenCalledOnce();
    expect(onCreated).toHaveBeenCalledWith(expected);
    expect(saved).toEqual(expected);
  });

  it('hands the created chat over and then rethrows when saving the settings fails', async () => {
    const failure = rejection(500);
    client.saveProjectConversation.mockRejectedValue(failure);

    await expect(
      createProjectChat(client, PROJECT_ID, REQUEST, SETTINGS, onCreated),
    ).rejects.toBe(failure);

    expect(onCreated).toHaveBeenCalledOnce();
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: CREATED.id, prompt: 'Be brief' }),
    );
  });

  it('rejects without handing anything over when the create fails', async () => {
    const failure = rejection(413, { code: 'project-storage-full' });
    client.createProjectConversation.mockRejectedValue(failure);

    await expect(
      createProjectChat(client, PROJECT_ID, REQUEST, SETTINGS, onCreated),
    ).rejects.toBe(failure);

    expect(client.saveProjectConversation).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });
});

describe('classifyProjectChatCreateError', () => {
  it('reports a full project as storage-full with the trace id', async () => {
    const error = new ResponseError(
      new Response(JSON.stringify({ code: 'project-storage-full' }), {
        status: 413,
        headers: {
          'Content-Type': 'application/json',
          traceparent:
            '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        },
      }),
    );

    await expect(classifyProjectChatCreateError(error)).resolves.toEqual({
      failure: ProjectChatCreateFailure.StorageFull,
      requestId: '0af7651916cd43dd8448eb211c80319c',
    });
  });

  it.each([
    ['another domain code', rejection(409, { code: 'name-taken' })],
    ['a failure with no code', rejection(503)],
    ['a network failure', new TypeError('offline')],
  ])('reports %s as a plain failure', async (_, error) => {
    const outcome = await classifyProjectChatCreateError(error);

    expect(outcome.failure).toBe(ProjectChatCreateFailure.Failed);
  });
});

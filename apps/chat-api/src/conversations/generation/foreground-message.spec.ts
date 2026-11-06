import { describe, expect, it, vi } from 'vitest';
import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import type { ConversationPersistencePort } from '../conversation-persistence.port';
import {
  ConversationMessageRole,
  type ConversationMessageDto,
} from '../dto/conversation-message.dto';
import { runConditionalUpdate } from '../persistence/conversation-persistence.service';
import { BackgroundWriteResult } from './background-message';
import {
  releasedForegroundFields,
  updateForegroundMessage,
} from './foreground-message';

const GEN = '4b2c8f1e-7d3a-4c5b-9e2f-0a1b2c3d4e5f';
const OTHER = '9d1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6';

const question: ConversationMessageDto = {
  role: ConversationMessageRole.User,
  content: 'hi',
  timestamp: 't0',
};
const rated: ConversationMessageDto = {
  role: ConversationMessageRole.Assistant,
  content: 'earlier answer',
  timestamp: 't1',
  rating: true,
} as ConversationMessageDto;
const marked = (
  generationId = GEN,
  extra: Partial<ConversationMessageDto> = {},
): ConversationMessageDto => ({
  role: ConversationMessageRole.Assistant,
  content: '',
  timestamp: 't2',
  foregroundGeneration: { generationId, startedAt: 1, expiresAt: 2 },
  ...extra,
});
const conversation = (
  messages: ConversationMessageDto[],
  extra: Partial<ConversationResponseDto> = {},
) => ({ id: 'c', name: 'Chat', messages, ...extra }) as ConversationResponseDto;

const makePersistence = (
  reads: Array<ConversationResponseDto | null>,
  saves: boolean[] = [true],
  etag: string | null = '"v1"',
) => {
  let r = 0;
  let w = 0;
  const persistence = {
    readConversationWithEtag: vi.fn(async () => {
      const next = reads[Math.min(r++, reads.length - 1)];
      return next ? { conversation: next, etag } : null;
    }),
    saveConversationIfMatch: vi.fn(async (_p, _t, _b, body) =>
      saves[Math.min(w++, saves.length - 1)]
        ? { isSaved: true, conversation: body }
        : { isSaved: false },
    ),
    saveConversation: vi.fn(),
    updateConversation: vi.fn(
      (
        ...args: Parameters<ConversationPersistencePort['updateConversation']>
      ) => runConditionalUpdate(persistence as never, ...args),
    ),
  };
  return persistence;
};

const finish = (persistence: ReturnType<typeof makePersistence>) =>
  updateForegroundMessage({
    persistence: persistence as never,
    conversationPath: 'c',
    token: 't',
    bucket: 'b',
    generationId: GEN,
    mutate: () => ({ content: 'final answer' }),
  });

const savedBody = (persistence: ReturnType<typeof makePersistence>) =>
  persistence.saveConversationIfMatch.mock.calls.at(-1)?.[3] as
    ConversationResponseDto | undefined;

describe('updateForegroundMessage', () => {
  it('writes the answer onto its own message and removes the marker', async () => {
    const persistence = makePersistence([conversation([question, marked()])]);

    const outcome = await finish(persistence);

    expect(outcome.result).toBe(BackgroundWriteResult.Applied);
    expect(savedBody(persistence)?.messages.at(-1)).toEqual({
      role: ConversationMessageRole.Assistant,
      content: 'final answer',
      timestamp: 't2',
    });
  });

  it('keeps client-owned fields, other messages and the conversation name as stored', async () => {
    const persistence = makePersistence([
      conversation([question, rated, marked(GEN, { rating: false } as never)], {
        name: 'Renamed',
      }),
    ]);

    await finish(persistence);

    const body = savedBody(persistence);
    expect(body?.name).toBe('Renamed');
    expect(body?.messages[1]).toEqual(rated);
    expect(body?.messages[2]).toMatchObject({ rating: false });
  });

  it('skips the write when the marker is no longer this generation', async () => {
    const persistence = makePersistence([
      conversation([question, marked(OTHER)]),
    ]);

    const outcome = await finish(persistence);

    expect(outcome.result).toBe(BackgroundWriteResult.Skipped);
    expect(persistence.saveConversationIfMatch).not.toHaveBeenCalled();
  });

  it('skips the write when the conversation is gone', async () => {
    const persistence = makePersistence([null]);

    expect((await finish(persistence)).result).toBe(
      BackgroundWriteResult.Skipped,
    );
    expect(persistence.saveConversation).not.toHaveBeenCalled();
  });

  it('re-reads and retries after a version conflict', async () => {
    const persistence = makePersistence(
      [
        conversation([question, marked()]),
        conversation([question, marked()], { name: 'Renamed' }),
      ],
      [false, true],
    );

    const outcome = await finish(persistence);

    expect(outcome.result).toBe(BackgroundWriteResult.Applied);
    expect(persistence.readConversationWithEtag).toHaveBeenCalledTimes(2);
    expect(savedBody(persistence)?.name).toBe('Renamed');
  });

  it('reports a conflict when every attempt meets a newer version', async () => {
    const persistence = makePersistence(
      [conversation([question, marked()])],
      [false],
    );

    const outcome = await finish(persistence);

    expect(outcome).toEqual({
      result: BackgroundWriteResult.Failed,
      isConflict: true,
    });
  });

  it('never writes a version read without an ETag', async () => {
    const persistence = makePersistence(
      [conversation([question, marked()])],
      [true],
      null,
    );

    expect((await finish(persistence)).result).toBe(
      BackgroundWriteResult.Failed,
    );
    expect(persistence.saveConversation).not.toHaveBeenCalled();
    expect(persistence.saveConversationIfMatch).not.toHaveBeenCalled();
  });

  it('applies a conversation-level change to the version it writes', async () => {
    const persistence = makePersistence([
      conversation([question, marked()], {
        customViewState: { layout: 'wide' },
      } as never),
    ]);

    await updateForegroundMessage({
      persistence: persistence as never,
      conversationPath: 'c',
      token: 't',
      bucket: 'b',
      generationId: GEN,
      mutate: () => ({ content: 'final answer' }),
      mutateConversation: (c) => ({
        ...c,
        customViewState: { ...c.customViewState, pool: true },
      }),
    });

    expect(savedBody(persistence)?.customViewState).toEqual({
      layout: 'wide',
      pool: true,
    });
  });
});

describe('releasedForegroundFields', () => {
  it('marks an unresolved placeholder interrupted and keeps its content', () => {
    expect(releasedForegroundFields(marked(GEN, { content: 'Hel' }))).toEqual({
      content: 'Hel',
      custom_content: undefined,
      responseId: undefined,
      streamErrorMessage: '',
      wasStoppedByUser: undefined,
    });
  });

  it('keeps a stopped answer stopped', () => {
    expect(
      releasedForegroundFields({
        ...marked(),
        wasStoppedByUser: true,
      } as never),
    ).toMatchObject({ wasStoppedByUser: true, streamErrorMessage: undefined });
  });
});

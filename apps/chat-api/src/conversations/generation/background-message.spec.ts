import { describe, expect, it, vi } from 'vitest';
import type { ConversationPersistencePort } from '../conversation-persistence.port';
import { BackgroundGenerationStatus } from '../dto/background-generation.dto';
import {
  ConversationMessageRole,
  type ConversationMessageDto,
} from '../dto/conversation-message.dto';
import { runConditionalUpdate } from '../persistence/conversation-persistence.service';
import {
  BackgroundWriteResult,
  findPendingBackgroundMessage,
  neutralizeForeignPendingMessages,
  updatePendingBackgroundMessage,
  withServerOwnedFields,
} from './background-message';

const GEN = 'gen-1';
const user: ConversationMessageDto = {
  role: ConversationMessageRole.User,
  content: 'hi',
  timestamp: 't0',
};
const pending = (extra: Partial<ConversationMessageDto> = {}) =>
  ({
    role: ConversationMessageRole.Assistant,
    content: '',
    timestamp: 't1',
    responseId: 'dial_r1',
    backgroundGeneration: {
      generationId: GEN,
      status: BackgroundGenerationStatus.Pending,
      startedAt: 1,
    },
    ...extra,
  }) as ConversationMessageDto;
const status: ConversationMessageDto = {
  role: ConversationMessageRole.Status,
  content: '',
  timestamp: 't2',
};
const conversation = (messages: ConversationMessageDto[]) =>
  ({ id: 'b/c', name: 'c', messages }) as never;

const makePersistence = (
  reads: Array<{
    messages: ConversationMessageDto[];
    etag: string | null;
  } | null>,
  saves: boolean[] = [true],
) => {
  let r = 0;
  let w = 0;
  const persistence = {
    readConversationWithEtag: vi.fn(async () => {
      const next = reads[Math.min(r++, reads.length - 1)];
      return next
        ? { conversation: conversation(next.messages), etag: next.etag }
        : null;
    }),
    saveConversationIfMatch: vi.fn(async (_p, _t, _b, body) =>
      saves[Math.min(w++, saves.length - 1)]
        ? { isSaved: true, conversation: body }
        : { isSaved: false },
    ),
    updateConversation: vi.fn(
      (
        ...args: Parameters<ConversationPersistencePort['updateConversation']>
      ) => runConditionalUpdate(persistence as never, ...args),
    ),
  } as unknown as ConversationPersistencePort & {
    readConversationWithEtag: ReturnType<typeof vi.fn>;
    saveConversationIfMatch: ReturnType<typeof vi.fn>;
  };
  return persistence;
};

const complete = (stored: ConversationMessageDto) => ({
  content: 'final answer',
  responseId: stored.responseId,
  backgroundGeneration: {
    ...stored.backgroundGeneration!,
    status: BackgroundGenerationStatus.Completed,
  },
});

const run = (persistence: ConversationPersistencePort) =>
  updatePendingBackgroundMessage({
    persistence,
    conversationPath: 'c',
    token: 'tok',
    bucket: 'b',
    generationId: GEN,
    mutate: complete,
  });

describe('updatePendingBackgroundMessage', () => {
  it('replaces the pending message in place with If-Match', async () => {
    const persistence = makePersistence([
      { messages: [user, pending()], etag: '"v1"' },
    ]);

    const outcome = await run(persistence);

    expect(outcome.result).toBe(BackgroundWriteResult.Applied);
    const [, , , body, etag] =
      persistence.saveConversationIfMatch.mock.calls[0];
    expect(etag).toBe('"v1"');
    expect(body.messages[1]).toMatchObject({
      content: 'final answer',
      backgroundGeneration: { status: BackgroundGenerationStatus.Completed },
    });
  });

  it('keeps a status message appended after the pending one and a stored rating', async () => {
    const persistence = makePersistence([
      {
        messages: [user, pending({ rating: 1 } as never), status],
        etag: '"v1"',
      },
    ]);

    await run(persistence);

    const body = persistence.saveConversationIfMatch.mock.calls[0][3];
    expect(body.messages).toHaveLength(3);
    expect(body.messages[2]).toEqual(status);
    expect(body.messages[1].rating).toBe(1);
  });

  it.each([
    [
      'finished',
      [
        user,
        pending({
          backgroundGeneration: {
            generationId: GEN,
            status: BackgroundGenerationStatus.Stopped,
            startedAt: 1,
          },
        }),
      ],
    ],
    ['removed', [user]],
  ])(
    'skips without writing when the message was %s',
    async (_label, messages) => {
      const persistence = makePersistence([{ messages, etag: '"v1"' }]);

      const outcome = await run(persistence);

      expect(outcome.result).toBe(BackgroundWriteResult.Skipped);
      expect(persistence.saveConversationIfMatch).not.toHaveBeenCalled();
    },
  );

  it('skips without writing when the conversation was deleted', async () => {
    const persistence = makePersistence([null]);

    expect((await run(persistence)).result).toBe(BackgroundWriteResult.Skipped);
    expect(persistence.saveConversationIfMatch).not.toHaveBeenCalled();
  });

  it('re-reads after a concurrent change and applies on the newer version', async () => {
    const persistence = makePersistence(
      [
        { messages: [user, pending()], etag: '"v1"' },
        { messages: [user, pending()], etag: '"v2"' },
      ],
      [false, true],
    );

    const outcome = await run(persistence);

    expect(outcome.result).toBe(BackgroundWriteResult.Applied);
    expect(persistence.saveConversationIfMatch.mock.calls[1][4]).toBe('"v2"');
  });

  it('fails after three conflicts', async () => {
    const persistence = makePersistence(
      [{ messages: [user, pending()], etag: '"v1"' }],
      [false],
    );

    expect((await run(persistence)).result).toBe(BackgroundWriteResult.Failed);
    expect(persistence.saveConversationIfMatch).toHaveBeenCalledTimes(3);
  });

  it('never writes a read that has no ETag', async () => {
    const persistence = makePersistence([
      { messages: [user, pending()], etag: null },
    ]);

    expect((await run(persistence)).result).toBe(BackgroundWriteResult.Failed);
    expect(persistence.saveConversationIfMatch).not.toHaveBeenCalled();
  });
});

describe('withServerOwnedFields', () => {
  it('drops stale server-owned fields that the new set does not carry', () => {
    const result = withServerOwnedFields(
      pending({ streamErrorMessage: 'old', rating: 1 } as never),
      { content: 'x', backgroundGeneration: pending().backgroundGeneration },
    );

    expect(result).not.toHaveProperty('streamErrorMessage');
    expect(result).not.toHaveProperty('responseId');
    expect(result).toMatchObject({ content: 'x', rating: 1, timestamp: 't1' });
  });
});

describe('findPendingBackgroundMessage', () => {
  it('finds a pending message at any position', () => {
    expect(
      findPendingBackgroundMessage({
        messages: [user, pending(), status],
      } as never),
    ).toEqual({ index: 1, message: pending() });
  });

  it('returns null when every background message is finished', () => {
    expect(
      findPendingBackgroundMessage({
        messages: [
          user,
          pending({
            backgroundGeneration: {
              generationId: GEN,
              status: BackgroundGenerationStatus.Completed,
              startedAt: 1,
            },
          }),
        ],
      } as never),
    ).toBeNull();
  });
});

describe('neutralizeForeignPendingMessages', () => {
  it('turns foreign pending markers into failed and keeps the allowed one', () => {
    const other = pending({
      backgroundGeneration: {
        generationId: 'gen-other',
        status: BackgroundGenerationStatus.Pending,
        startedAt: 1,
      },
    });

    const [kept, neutralized] = neutralizeForeignPendingMessages(
      [pending(), other],
      GEN,
    );

    expect(kept).toEqual(pending());
    expect(neutralized).toMatchObject({
      streamErrorMessage: '',
      backgroundGeneration: {
        generationId: 'gen-other',
        status: BackgroundGenerationStatus.Failed,
      },
    });
  });

  it('leaves finished and non-background messages unchanged', () => {
    const finished = pending({
      backgroundGeneration: {
        generationId: GEN,
        status: BackgroundGenerationStatus.Completed,
        startedAt: 1,
      },
    });

    expect(neutralizeForeignPendingMessages([user, finished])).toEqual([
      user,
      finished,
    ]);
  });
});

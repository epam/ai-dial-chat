import { describe, expect, it, vi } from 'vitest';
import {
  ConditionalUpdateStatus,
  type ConversationPersistencePort,
} from '../conversation-persistence.port';
import {
  BackgroundGenerationDto,
  BackgroundGenerationStatus,
} from '../dto/background-generation.dto';
import {
  ConversationMessageRole,
  type ConversationMessageDto,
} from '../dto/conversation-message.dto';
import { runConditionalUpdate } from '../persistence/conversation-persistence.service';
import {
  BackgroundWriteResult,
  findPendingBackgroundMessage,
  mergeClientMessages,
  neutralizeForeignPendingMessages,
  updateConversationUnlessPending,
  updatePendingBackgroundMessage,
  withServerOwnedFields,
  type StoredMessage,
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
    ...(stored.backgroundGeneration as BackgroundGenerationDto),
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

describe('client saves against a foreground generation', () => {
  const FG = '4b2c8f1e-7d3a-4c5b-9e2f-0a1b2c3d4e5f';
  const OTHER_FG = '9d1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6';
  const question = (content: string): StoredMessage => ({
    role: ConversationMessageRole.User,
    content,
    timestamp: 'tq',
  });
  const answer = (
    content: string,
    extra: Partial<StoredMessage> = {},
  ): StoredMessage => ({
    role: ConversationMessageRole.Assistant,
    content,
    timestamp: 'ta',
    ...extra,
  });
  const LIVE_UNTIL = Date.now() + 3_600_000;
  const marker = (generationId: string, expiresAt = LIVE_UNTIL) => ({
    foregroundGeneration: { generationId, startedAt: 1, expiresAt },
  });

  it('keeps a running exchange a stale tab has never seen', () => {
    const stored = [
      question('q1'),
      answer('a1'),
      question('q2'),
      answer('', marker(FG)),
    ];
    const body = [question('q1'), answer('a1', { rating: true } as never)];

    const merged = mergeClientMessages(body, stored);

    expect(merged).toEqual([
      question('q1'),
      answer('a1', { rating: true } as never),
      question('q2'),
      answer('', marker(FG)),
    ]);
  });

  it("keeps the stored marker on the generating tab's own unmarked placeholder", () => {
    const stored = [question('q1'), answer('', marker(FG))];
    const body = [question('q1'), answer('Hel', { rating: false } as never)];

    const [, saved] = mergeClientMessages(body, stored);

    expect(saved).toEqual(
      answer('', { ...marker(FG), rating: false } as never),
    );
  });

  it('removes a marker a client body carries that storage does not hold as live', () => {
    const stored = [question('q1'), answer('a1')];
    const body = [
      question('q1'),
      answer('a1'),
      question('q2'),
      answer('', marker(OTHER_FG)),
    ];

    const merged = mergeClientMessages(body, stored);

    expect(merged.at(-1)).toEqual(answer('', { streamErrorMessage: '' }));
  });

  it('gives a stale copy of a finished foreground answer the stored answer', () => {
    const stored = [question('q1'), answer('final answer')];
    const body = [question('q1'), answer('', marker(OTHER_FG))];

    const [, saved] = mergeClientMessages(body, stored);

    expect(saved).toEqual(answer('final answer'));
  });

  it('treats an expired stored marker as absent', () => {
    const stored = [question('q1'), answer('', marker(FG, Date.now() - 1))];
    const body = [question('q1')];

    expect(mergeClientMessages(body, stored)).toEqual([question('q1')]);
  });

  it('stays a conflict when persistent conflicts meet a live foreground marker', async () => {
    const conversation = {
      id: 'c',
      messages: [question('q1'), answer('', marker(FG))],
    };
    const persistence = {
      updateConversation: vi.fn().mockResolvedValue({
        status: ConditionalUpdateStatus.Conflict,
      }),
      readConversationWithEtag: vi
        .fn()
        .mockResolvedValue({ conversation, etag: '"v9"' }),
      saveConversation: vi.fn(),
    };

    const result = await updateConversationUnlessPending(
      persistence as never,
      'c',
      't',
      'b',
      (stored) => stored?.conversation ?? null,
    );

    expect(result.status).toBe(ConditionalUpdateStatus.Conflict);
    expect(persistence.saveConversation).not.toHaveBeenCalled();
  });
});

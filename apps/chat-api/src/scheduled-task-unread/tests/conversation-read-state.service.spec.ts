import { HttpException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import {
  ConversationReadStateService,
  isProjectConversationUnread,
  isRegularConversationUnread,
} from '../conversation-read-state.service';
import { parseViewedConversations } from '../dto/viewed-conversations.dto';

const BASELINE_PATH = '.client_data/.conversations-read-baseline.json';
const VIEWED_PATH = '.client_data/.viewed-conversations.json';
const NOW = 5_000;

type Stored = Record<string, string>;

/* In-memory stand-in for the user's bucket: download reads `files`, upload parses the FormData back into it. */
const makeBucket = (
  files: Stored = {},
  failing: Record<string, number> = {},
) => {
  const uploads: string[] = [];
  const dialClient = {
    client: {
      downloadFile: vi.fn(async (_bucket: string, path: string) => {
        const status = failing[path] ?? (path in files ? 200 : 404);
        return {
          response: {
            ok: status === 200,
            status,
            text: async (): Promise<string> => files[path] ?? '',
          },
        };
      }),
      uploadFile: vi.fn(
        async (_bucket: string, path: string, options: { body: unknown }) => {
          uploads.push(path);
          if (failing[`upload:${path}`]) {
            return {
              error: 'boom',
              response: {
                status: 500,
                text: async (): Promise<string> => 'boom',
              },
            };
          }
          const blob = (options.body as FormData).get('file') as Blob;
          files[path] = await blob.text();
          return {
            response: { status: 200, text: async (): Promise<string> => '' },
          };
        },
      ),
    },
  } as unknown as DialClientService;
  return { dialClient, files, uploads };
};

const json = (value: unknown) => JSON.stringify(value);

const makeScheduledTaskUnread = () => ({
  markViewed: vi.fn().mockResolvedValue(undefined),
});

const makeService = (
  dialClient: DialClientService,
  scheduledTaskUnread = makeScheduledTaskUnread(),
) => new ConversationReadStateService(dialClient, scheduledTaskUnread as never);

describe('ConversationReadStateService', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getReadState', () => {
    it('creates the baseline with the current time when the file is missing', async () => {
      const bucket = makeBucket();
      const service = makeService(bucket.dialClient);

      const state = await service.getReadState('token', 'b');

      expect(state?.readBefore).toBe(NOW);
      expect(JSON.parse(bucket.files[BASELINE_PATH])).toEqual({
        version: 1,
        readBefore: NOW,
      });
    });

    it('never rewrites an existing baseline', async () => {
      const bucket = makeBucket({
        [BASELINE_PATH]: json({ version: 1, readBefore: 1000 }),
      });
      const service = makeService(bucket.dialClient);

      const state = await service.getReadState('token', 'b');

      expect(state?.readBefore).toBe(1000);
      expect(bucket.uploads).not.toContain(BASELINE_PATH);
    });

    it('reports no state and writes nothing when the baseline read fails with a 5xx', async () => {
      const bucket = makeBucket({}, { [BASELINE_PATH]: 503 });
      const service = makeService(bucket.dialClient);

      await expect(service.getReadState('token', 'b')).resolves.toBeNull();
      expect(bucket.uploads).toEqual([]);
    });

    it('reports no state and writes nothing when the baseline file is malformed', async () => {
      const bucket = makeBucket({ [BASELINE_PATH]: '{not json' });
      const service = makeService(bucket.dialClient);

      await expect(service.getReadState('token', 'b')).resolves.toBeNull();
      expect(bucket.uploads).toEqual([]);
    });

    it('reports no state when the baseline has no numeric readBefore', async () => {
      const bucket = makeBucket({
        [BASELINE_PATH]: json({ version: 1, readBefore: 'yesterday' }),
      });
      const service = makeService(bucket.dialClient);

      await expect(service.getReadState('token', 'b')).resolves.toBeNull();
      expect(bucket.uploads).toEqual([]);
    });

    it('reports no state when the lazy baseline write fails', async () => {
      const bucket = makeBucket({}, { [`upload:${BASELINE_PATH}`]: 500 });
      const service = makeService(bucket.dialClient);

      await expect(service.getReadState('token', 'b')).resolves.toBeNull();
    });

    it('reports no state when the viewed ids read fails with a 5xx', async () => {
      const bucket = makeBucket(
        { [BASELINE_PATH]: json({ version: 1, readBefore: 1000 }) },
        { [VIEWED_PATH]: 500 },
      );
      const service = makeService(bucket.dialClient);

      await expect(service.getReadState('token', 'b')).resolves.toBeNull();
    });

    it('writes no baseline when the viewed ids cannot be read', async () => {
      const bucket = makeBucket({}, { [VIEWED_PATH]: 500 });
      const service = makeService(bucket.dialClient);

      await expect(service.getReadState('token', 'b')).resolves.toBeNull();
      expect(bucket.uploads).toEqual([]);
    });

    it('treats a missing or malformed viewed file as an empty set', async () => {
      const baseline = { [BASELINE_PATH]: json({ version: 1, readBefore: 1 }) };
      const missing = await makeService(
        makeBucket({ ...baseline }).dialClient,
      ).getReadState('token', 'b');
      const malformed = await makeService(
        makeBucket({ ...baseline, [VIEWED_PATH]: 'nope' }).dialClient,
      ).getReadState('token', 'b');

      expect(missing?.viewedIds.size).toBe(0);
      expect(malformed?.viewedIds.size).toBe(0);
    });

    it('exposes viewed ids URI-decoded', async () => {
      const bucket = makeBucket({
        [BASELINE_PATH]: json({ version: 1, readBefore: 1 }),
        [VIEWED_PATH]: json({
          version: 1,
          conversationIds: ['conversations/b/gpt__My%20chat__1'],
        }),
      });
      const state = await makeService(bucket.dialClient).getReadState(
        'token',
        'b',
      );

      expect(state?.viewedIds.has('conversations/b/gpt__My chat__1')).toBe(
        true,
      );
    });
  });

  describe('addViewed / removeViewed', () => {
    const id = 'conversations/b/gpt__chat__1';

    it('stores an id once when it is added twice', async () => {
      const bucket = makeBucket();
      const service = makeService(bucket.dialClient);

      await service.addViewed(id, 'token', 'b');
      await service.addViewed(id, 'token', 'b');

      expect(JSON.parse(bucket.files[VIEWED_PATH]).conversationIds).toEqual([
        id,
      ]);
      expect(bucket.uploads).toEqual([VIEWED_PATH]);
    });

    it('does not write when removing an id that is absent', async () => {
      const bucket = makeBucket({
        [VIEWED_PATH]: json({ version: 1, conversationIds: ['other'] }),
      });
      await makeService(bucket.dialClient).removeViewed(id, 'token', 'b');

      expect(bucket.uploads).toEqual([]);
    });

    it('removes a present id even when stored and requested forms differ by URI encoding', async () => {
      const bucket = makeBucket({
        [VIEWED_PATH]: json({
          version: 1,
          conversationIds: ['conversations/b/gpt__My%20chat__1', 'keep'],
        }),
      });
      await makeService(bucket.dialClient).removeViewed(
        'conversations/b/gpt__My chat__1',
        'token',
        'b',
      );

      expect(JSON.parse(bucket.files[VIEWED_PATH]).conversationIds).toEqual([
        'keep',
      ]);
    });

    it('does not overwrite the stored ids when the read fails', async () => {
      const bucket = makeBucket({}, { [VIEWED_PATH]: 503 });
      const service = makeService(bucket.dialClient);

      await expect(service.addViewed(id, 'token', 'b')).rejects.toBeInstanceOf(
        HttpException,
      );
      expect(bucket.uploads).toEqual([]);
    });
  });
});

describe('ConversationReadStateService.getReadBefore', () => {
  it('returns the stored baseline without touching the viewed ids', async () => {
    const bucket = makeBucket({
      [BASELINE_PATH]: json({ version: 1, readBefore: 1000 }),
    });

    await expect(
      makeService(bucket.dialClient).getReadBefore('token', 'b'),
    ).resolves.toBe(1000);

    expect(bucket.dialClient.client.downloadFile).toHaveBeenCalledTimes(1);
    expect(bucket.uploads).toEqual([]);
  });

  it('does not create the baseline when it is missing', async () => {
    const bucket = makeBucket();

    await expect(
      makeService(bucket.dialClient).getReadBefore('token', 'b'),
    ).resolves.toBeNull();

    expect(bucket.uploads).toEqual([]);
  });

  it.each([
    ['a failed read', { [BASELINE_PATH]: 503 }, {}],
    ['a malformed file', {}, { [BASELINE_PATH]: '{nope' }],
  ])('reports no baseline for %s', async (_label, failing, files) => {
    const bucket = makeBucket(files as Stored, failing);

    await expect(
      makeService(bucket.dialClient).getReadBefore('token', 'b'),
    ).resolves.toBeNull();
  });
});

describe('ConversationReadStateService routing by conversation kind', () => {
  const RUN =
    'conversations/b/.scheduler/sched_abc/gpt-4o__Run__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5';
  const CHAT = 'conversations/b/gpt-4o__Chat__uuid';

  it('records a regular chat in the viewed conversations file, not the scheduler file', async () => {
    const bucket = makeBucket();
    const scheduled = makeScheduledTaskUnread();

    await makeService(bucket.dialClient, scheduled).markViewed(
      CHAT,
      'token',
      'b',
    );

    expect(JSON.parse(bucket.files[VIEWED_PATH]).conversationIds).toEqual([
      CHAT,
    ]);
    expect(scheduled.markViewed).not.toHaveBeenCalled();
  });

  it('hands a scheduler run to the scheduler viewed-ids service and writes no regular file', async () => {
    const bucket = makeBucket();
    const scheduled = makeScheduledTaskUnread();

    await makeService(bucket.dialClient, scheduled).markViewed(
      RUN,
      'token',
      'b',
    );

    expect(scheduled.markViewed).toHaveBeenCalledExactlyOnceWith(
      RUN,
      'token',
      'b',
    );
    expect(bucket.uploads).toEqual([]);
  });

  it('removes a regular chat from the viewed ids when it is un-viewed', async () => {
    const bucket = makeBucket({
      [VIEWED_PATH]: json({ version: 1, conversationIds: [CHAT, 'keep'] }),
    });

    await makeService(bucket.dialClient).markUnviewed(CHAT, 'token', 'b');

    expect(JSON.parse(bucket.files[VIEWED_PATH]).conversationIds).toEqual([
      'keep',
    ]);
  });

  it('swallows and logs a failure when un-viewing, so a generation never fails on it', async () => {
    const bucket = makeBucket({}, { [VIEWED_PATH]: 503 });
    const service = makeService(bucket.dialClient);
    const warn = vi.spyOn(service['logger'], 'warn');

    await expect(
      service.markUnviewed(CHAT, 'token', 'b'),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      'Failed to mark conversation as unviewed',
      expect.anything(),
    );
    expect(bucket.uploads).toEqual([]);
  });

  it('does not touch any file when a scheduler run is un-viewed', async () => {
    const bucket = makeBucket({
      [VIEWED_PATH]: json({ version: 1, conversationIds: [RUN] }),
    });

    await makeService(bucket.dialClient).markUnviewed(RUN, 'token', 'b');

    expect(bucket.uploads).toEqual([]);
  });
});

describe('isRegularConversationUnread', () => {
  const state = {
    readBefore: 1000,
    viewedIds: new Set(['conversations/b/seen']),
  };

  it('is read when updated at or before the baseline', () => {
    expect(
      isRegularConversationUnread(state, 'conversations/b/old', 1000),
    ).toBe(false);
  });

  it('is unread when updated after the baseline and not viewed', () => {
    expect(
      isRegularConversationUnread(state, 'conversations/b/new', 1001),
    ).toBe(true);
  });

  it('is read when updated after the baseline but viewed', () => {
    expect(
      isRegularConversationUnread(state, 'conversations/b/seen', 5000),
    ).toBe(false);
  });

  it('compares ids after URI decoding', () => {
    const encoded = {
      readBefore: 0,
      viewedIds: new Set(['conversations/b/My chat']),
    };
    expect(
      isRegularConversationUnread(encoded, 'conversations/b/My%20chat', 10),
    ).toBe(false);
  });
});

describe('parseViewedConversations', () => {
  it('reads a file without the project field as an empty project map', () => {
    expect(
      parseViewedConversations({ version: 1, conversationIds: ['c'] }),
    ).toEqual({
      version: 1,
      conversationIds: ['c'],
      projectConversationIds: {},
    });
  });

  it('drops malformed project entries and non-string versions and keeps the rest', () => {
    expect(
      parseViewedConversations({
        version: 1,
        conversationIds: [],
        projectConversationIds: {
          'projects/a/p': ['not-a-map'],
          'projects/a/q': {
            'projects/a/q/conversations/c': 'sha256:1',
            'projects/a/q/conversations/d': 7,
          },
          'projects/a/r': { 'projects/a/r/conversations/e': null },
        },
      }).projectConversationIds,
    ).toEqual({
      'projects/a/q': { 'projects/a/q/conversations/c': 'sha256:1' },
    });
  });

  it('reads a non-object project field as an empty map', () => {
    expect(
      parseViewedConversations({ projectConversationIds: 'x' })
        .projectConversationIds,
    ).toEqual({});
  });
});

describe('ConversationReadStateService — project read state', () => {
  const PROJECT = 'projects/a1b2c3/q4';
  const CHAT = `${PROJECT}/conversations/gpt__Summary__1`;

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const stored = (bucket: ReturnType<typeof makeBucket>) =>
    JSON.parse(bucket.files[VIEWED_PATH]);

  it('returns the baseline and the versions of one project, creating the baseline when missing', async () => {
    const bucket = makeBucket({
      [VIEWED_PATH]: json({
        version: 1,
        conversationIds: [],
        projectConversationIds: {
          [PROJECT]: { [CHAT]: 'sha256:1' },
          'projects/a1b2c3/other': { x: 'sha256:9' },
        },
      }),
    });

    const state = await makeService(bucket.dialClient).getProjectReadState(
      PROJECT,
      'token',
      'b',
    );

    expect(state?.readBefore).toBe(NOW);
    expect([...(state?.versions ?? [])]).toEqual([[CHAT, 'sha256:1']]);
    expect(bucket.uploads).toEqual([BASELINE_PATH]);
  });

  it('fails closed when the viewed file cannot be read', async () => {
    const bucket = makeBucket(
      { [BASELINE_PATH]: json({ version: 1, readBefore: 1 }) },
      { [VIEWED_PATH]: 503 },
    );

    await expect(
      makeService(bucket.dialClient).getProjectReadState(PROJECT, 't', 'b'),
    ).resolves.toBeNull();
  });

  it('stores the viewed version and keeps the regular ids', async () => {
    const bucket = makeBucket({
      [VIEWED_PATH]: json({ version: 1, conversationIds: ['conversations/x'] }),
    });

    await makeService(bucket.dialClient).markProjectConversationViewed(
      PROJECT,
      CHAT,
      'sha256:2',
      't',
      'b',
    );

    expect(stored(bucket)).toEqual({
      version: 1,
      conversationIds: ['conversations/x'],
      projectConversationIds: { [PROJECT]: { [CHAT]: 'sha256:2' } },
    });
  });

  it('does not upload when the viewed version is unchanged', async () => {
    const bucket = makeBucket({
      [VIEWED_PATH]: json({
        version: 1,
        conversationIds: [],
        projectConversationIds: { [PROJECT]: { [CHAT]: 'sha256:2' } },
      }),
    });

    await makeService(bucket.dialClient).markProjectConversationViewed(
      PROJECT,
      CHAT,
      'sha256:2',
      't',
      'b',
    );

    expect(bucket.uploads).toEqual([]);
  });

  it('keeps the project state when a regular chat is marked viewed', async () => {
    const projects = { [PROJECT]: { [CHAT]: 'sha256:1' } };
    const bucket = makeBucket({
      [VIEWED_PATH]: json({
        version: 1,
        conversationIds: [],
        projectConversationIds: projects,
      }),
    });

    await makeService(bucket.dialClient).addViewed(
      'conversations/b/chat',
      't',
      'b',
    );

    expect(stored(bucket).projectConversationIds).toEqual(projects);
  });

  it('carries a viewed version over a write the user did not see as a change', async () => {
    const bucket = makeBucket({
      [VIEWED_PATH]: json({
        version: 1,
        conversationIds: [],
        projectConversationIds: { [PROJECT]: { [CHAT]: 'sha256:1' } },
      }),
    });
    const service = makeService(bucket.dialClient);

    await service.carryProjectConversationViewed(
      PROJECT,
      CHAT,
      'sha256:1',
      'sha256:2',
      't',
      'b',
    );
    await service.carryProjectConversationViewed(
      PROJECT,
      CHAT,
      'sha256:9',
      'sha256:3',
      't',
      'b',
    );

    expect(stored(bucket).projectConversationIds).toEqual({
      [PROJECT]: { [CHAT]: 'sha256:2' },
    });
    expect(bucket.uploads).toEqual([VIEWED_PATH]);
  });

  it('does not mark a never-viewed chat when carrying a version', async () => {
    const bucket = makeBucket({
      [VIEWED_PATH]: json({ version: 1, conversationIds: [] }),
    });

    await makeService(bucket.dialClient).carryProjectConversationViewed(
      PROJECT,
      CHAT,
      'sha256:1',
      'sha256:2',
      't',
      'b',
    );

    expect(bucket.uploads).toEqual([]);
  });

  it('removes a conversation and drops the emptied project key', async () => {
    const bucket = makeBucket({
      [VIEWED_PATH]: json({
        version: 1,
        conversationIds: [],
        projectConversationIds: { [PROJECT]: { [CHAT]: 'sha256:1' } },
      }),
    });

    await makeService(bucket.dialClient).removeProjectConversation(
      PROJECT,
      CHAT,
      't',
      'b',
    );

    expect(stored(bucket).projectConversationIds).toEqual({});
  });

  it('does not upload when removing an absent project', async () => {
    const bucket = makeBucket({
      [VIEWED_PATH]: json({ version: 1, conversationIds: [] }),
    });

    await makeService(bucket.dialClient).removeProject(PROJECT, 't', 'b');

    expect(bucket.uploads).toEqual([]);
  });

  it('re-keys a renamed project and rewrites its locators', async () => {
    const NEW = 'projects/a1b2c3/q4-final';
    const bucket = makeBucket({
      [VIEWED_PATH]: json({
        version: 1,
        conversationIds: [],
        projectConversationIds: {
          [PROJECT]: { [CHAT]: 'sha256:1' },
          [NEW]: { [`${NEW}/conversations/kept`]: 'sha256:5' },
        },
      }),
    });

    await makeService(bucket.dialClient).renameProject(PROJECT, NEW, 't', 'b');

    expect(stored(bucket).projectConversationIds).toEqual({
      [NEW]: {
        [`${NEW}/conversations/kept`]: 'sha256:5',
        [`${NEW}/conversations/gpt__Summary__1`]: 'sha256:1',
      },
    });
  });
});

describe('isProjectConversationUnread', () => {
  const CHAT = 'projects/a/p/conversations/c';
  const state = {
    readBefore: 1000,
    versions: new Map([[CHAT, 'sha256:1']]),
  };

  it('is read when updated at or before the baseline', () => {
    expect(isProjectConversationUnread(state, 'x', 1000, 'sha256:9')).toBe(
      false,
    );
  });

  it('is unread when changed after the baseline and never viewed', () => {
    expect(isProjectConversationUnread(state, 'x', 1001, 'sha256:9')).toBe(
      true,
    );
  });

  it('is read when the viewed version is the current one', () => {
    expect(isProjectConversationUnread(state, CHAT, 5000, 'sha256:1')).toBe(
      false,
    );
  });

  it('is unread when a newer version exists than the one viewed', () => {
    expect(isProjectConversationUnread(state, CHAT, 5000, 'sha256:2')).toBe(
      true,
    );
  });

  it('is read when the version or the time is unknown', () => {
    expect(isProjectConversationUnread(state, 'x', 5000, undefined)).toBe(
      false,
    );
    expect(isProjectConversationUnread(state, 'x', undefined, 'v')).toBe(false);
  });
});

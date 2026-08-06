import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import type { DialClientService } from '../../dial/dial-client.service';
import {
  DEFAULT_VIEWED_SCHEDULED_TASK_CONVERSATIONS,
  parseViewedScheduledTaskConversations,
} from '../dto/viewed-scheduled-task-conversations.dto';
import { ScheduledTaskUnreadService } from '../scheduled-task-unread.service';

vi.mock('../../common/dial/dial-error.mapper', () => ({
  handleDialSdkError: vi.fn(),
}));

const makeDialClient = () =>
  ({
    client: {
      downloadFile: vi.fn(),
      uploadFile: vi.fn(),
    },
    baseUrl: 'http://localhost:3000',
    dialApiVersion: '2024-10-21',
  }) as unknown as DialClientService;

const makeDownloadSpy = (
  service: ScheduledTaskUnreadService,
  options: { ok: boolean; body?: string },
) =>
  vi.spyOn(service['dialClient'].client, 'downloadFile').mockResolvedValue({
    response: {
      ok: options.ok,
      text: async () => options.body ?? '',
    },
  } as never);

const makeUploadSpy = (
  service: ScheduledTaskUnreadService,
  options: { error?: unknown; status?: number } = {},
) =>
  vi.spyOn(service['dialClient'].client, 'uploadFile').mockResolvedValue({
    error: options.error,
    response: {
      status: options.status ?? 200,
      text: async () => (options.error ? 'error body' : ''),
    },
  } as never);

const getUploadedConfig = async (uploadSpy: ReturnType<typeof vi.spyOn>) => {
  const formData = (uploadSpy.mock.calls[0] as unknown[])[2] as {
    body: FormData;
  };
  const file = formData.body.get('file') as Blob;
  return JSON.parse(await file.text()) as { conversationIds: string[] };
};

describe('parseViewedScheduledTaskConversations', () => {
  it('returns default for null input', () => {
    expect(parseViewedScheduledTaskConversations(null)).toEqual(
      DEFAULT_VIEWED_SCHEDULED_TASK_CONVERSATIONS,
    );
  });

  it('returns default for non-object input', () => {
    expect(parseViewedScheduledTaskConversations('string')).toEqual(
      DEFAULT_VIEWED_SCHEDULED_TASK_CONVERSATIONS,
    );
  });

  it('filters non-string entries from conversationIds', () => {
    const result = parseViewedScheduledTaskConversations({
      version: 1,
      conversationIds: ['valid', 42, null, 'also-valid'],
    });
    expect(result.conversationIds).toEqual(['valid', 'also-valid']);
  });

  it('defaults conversationIds to [] when not an array', () => {
    const result = parseViewedScheduledTaskConversations({
      version: 1,
      conversationIds: 'not-an-array',
    });
    expect(result.conversationIds).toEqual([]);
  });
});

describe('ScheduledTaskUnreadService', () => {
  let service: ScheduledTaskUnreadService;

  beforeEach(() => {
    service = new ScheduledTaskUnreadService(makeDialClient());
    vi.mocked(handleDialSdkError).mockReset();
  });

  describe('getViewedIds', () => {
    it('returns [] when the file does not exist', async () => {
      makeDownloadSpy(service, { ok: false });
      const result = await service.getViewedIds('token', 'bucket');
      expect(result).toEqual([]);
    });

    it('returns [] and logs a warning when the file is malformed', async () => {
      makeDownloadSpy(service, { ok: true, body: 'not valid json{' });
      const warnSpy = vi.spyOn(service['logger'], 'warn');
      const result = await service.getViewedIds('token', 'bucket');
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('returns [] when downloadFile throws', async () => {
      vi.spyOn(service['dialClient'].client, 'downloadFile').mockRejectedValue(
        new Error('network'),
      );
      const result = await service.getViewedIds('token', 'bucket');
      expect(result).toEqual([]);
    });

    it('returns stored conversationIds when the file exists', async () => {
      makeDownloadSpy(service, {
        ok: true,
        body: JSON.stringify({
          version: 1,
          conversationIds: ['conversations/bucket/a'],
        }),
      });
      const result = await service.getViewedIds('token', 'bucket');
      expect(result).toEqual(['conversations/bucket/a']);
    });
  });

  describe('markViewed', () => {
    it('appends a new id to an empty store', async () => {
      makeDownloadSpy(service, { ok: false });
      const uploadSpy = makeUploadSpy(service);
      await service.markViewed('conversations/bucket/a', 'token', 'bucket');
      const uploaded = await getUploadedConfig(uploadSpy);
      expect(uploaded.conversationIds).toEqual(['conversations/bucket/a']);
    });

    it('appends a new id alongside existing ones', async () => {
      makeDownloadSpy(service, {
        ok: true,
        body: JSON.stringify({
          version: 1,
          conversationIds: ['conversations/bucket/a'],
        }),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.markViewed('conversations/bucket/b', 'token', 'bucket');
      const uploaded = await getUploadedConfig(uploadSpy);
      expect(uploaded.conversationIds).toEqual([
        'conversations/bucket/a',
        'conversations/bucket/b',
      ]);
    });

    it('is idempotent — does not duplicate an already-viewed id', async () => {
      makeDownloadSpy(service, {
        ok: true,
        body: JSON.stringify({
          version: 1,
          conversationIds: ['conversations/bucket/a'],
        }),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.markViewed('conversations/bucket/a', 'token', 'bucket');
      const uploaded = await getUploadedConfig(uploadSpy);
      expect(
        uploaded.conversationIds.filter(
          (id) => id === 'conversations/bucket/a',
        ),
      ).toHaveLength(1);
    });

    it('calls handleDialSdkError when DIAL Core returns an error', async () => {
      makeDownloadSpy(service, { ok: false });
      makeUploadSpy(service, { error: 'bad', status: 400 });
      await service.markViewed('conversations/bucket/a', 'token', 'bucket');
      expect(handleDialSdkError).toHaveBeenCalledWith(
        'bad',
        'scheduled-task-unread.writeConfig',
        expect.anything(),
        expect.objectContaining({ status: 400 }),
      );
    });
  });
});

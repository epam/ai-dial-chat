import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDialError } from '../../common/utils/dial-error';
import {
  CURRENT_CONFIG_VERSION,
  DEFAULT_USER_CONFIG,
} from '../dto/user-config.dto';
import { UserConfigService } from '../user-config.service';

vi.mock('../../common/utils/dial-error', () => ({
  handleDialError: vi.fn(),
}));

const makeConfigService = () =>
  ({
    get: vi.fn((key: string) => {
      if (key === 'DIAL_CORE_URL') return 'http://localhost:3000';
      if (key === 'DIAL_API_KEY') return 'test-api-key';
      return undefined;
    }),
  }) as unknown as ConfigService;

const makeDownloadSpy = (
  service: UserConfigService,
  options: { ok: boolean; body?: string },
) =>
  vi.spyOn(service['client'], 'downloadFile').mockResolvedValue({
    response: {
      ok: options.ok,
      text: async () => options.body ?? '',
    },
  } as never);

const makeUploadSpy = (
  service: UserConfigService,
  options: { error?: unknown; status?: number } = {},
) =>
  vi.spyOn(service['client'], 'uploadFile').mockResolvedValue({
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
  return JSON.parse(await file.text()) as unknown;
};

describe('UserConfigService', () => {
  let service: UserConfigService;

  beforeEach(() => {
    service = new UserConfigService(makeConfigService());
    vi.mocked(handleDialError).mockReset();
  });

  describe('readConfig', () => {
    it('returns default config when DIAL Core returns non-ok response', async () => {
      makeDownloadSpy(service, { ok: false });
      const result = await service.readConfig('token', 'bucket');
      expect(result).toEqual(DEFAULT_USER_CONFIG);
    });

    it('returns parsed config for a valid file', async () => {
      const stored = {
        version: 1,
        pinnedConversationIds: ['conversations/bucket/gpt-4__chat__uuid'],
      };
      makeDownloadSpy(service, { ok: true, body: JSON.stringify(stored) });
      const result = await service.readConfig('token', 'bucket');
      expect(result).toEqual(stored);
    });

    it('returns default config on JSON parse error', async () => {
      makeDownloadSpy(service, { ok: true, body: 'not valid json{' });
      const result = await service.readConfig('token', 'bucket');
      expect(result).toEqual(DEFAULT_USER_CONFIG);
    });

    it('returns default config when downloadFile throws', async () => {
      vi.spyOn(service['client'], 'downloadFile').mockRejectedValue(
        new Error('network'),
      );
      const result = await service.readConfig('token', 'bucket');
      expect(result).toEqual(DEFAULT_USER_CONFIG);
    });

    it('migrates a config that is missing the version field', async () => {
      const legacy = {
        pinnedConversationIds: ['conversations/bucket/old__chat__uuid'],
      };
      makeDownloadSpy(service, { ok: true, body: JSON.stringify(legacy) });
      const result = await service.readConfig('token', 'bucket');
      expect(result.version).toBe(CURRENT_CONFIG_VERSION);
      expect(result.pinnedConversationIds).toEqual(
        legacy.pinnedConversationIds,
      );
    });

    it('filters out non-string entries in pinnedConversationIds during migration', async () => {
      const corrupt = {
        version: 1,
        pinnedConversationIds: ['valid', 42, null, 'also-valid'],
      };
      makeDownloadSpy(service, { ok: true, body: JSON.stringify(corrupt) });
      const result = await service.readConfig('token', 'bucket');
      expect(result.pinnedConversationIds).toEqual(['valid', 'also-valid']);
    });
  });

  describe('writeConfig', () => {
    it('uploads the config as multipart FormData', async () => {
      const uploadSpy = makeUploadSpy(service);
      const config = { version: 1, pinnedConversationIds: ['id-1'] };
      await service.writeConfig(config, 'token', 'bucket');
      expect(uploadSpy).toHaveBeenCalledWith(
        'bucket',
        '.user-config.json',
        expect.any(Object),
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect(uploaded).toEqual(config);
    });

    it('calls handleDialError when DIAL Core returns an error', async () => {
      makeUploadSpy(service, { error: 'bad', status: 400 });
      await service.writeConfig(DEFAULT_USER_CONFIG, 'token', 'bucket');
      expect(handleDialError).toHaveBeenCalledWith({ status: 400 });
    });

    it('re-throws when uploadFile itself throws', async () => {
      vi.spyOn(service['client'], 'uploadFile').mockRejectedValue(
        new Error('network'),
      );
      await expect(
        service.writeConfig(DEFAULT_USER_CONFIG, 'token', 'bucket'),
      ).rejects.toThrow('network');
    });
  });

  describe('updatePin', () => {
    it('adds a new id when pinning', async () => {
      makeDownloadSpy(service, {
        ok: true,
        body: JSON.stringify({ version: 1, pinnedConversationIds: [] }),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updatePin(
        'conversations/bucket/id',
        true,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect(
        (uploaded as { pinnedConversationIds: string[] }).pinnedConversationIds,
      ).toContain('conversations/bucket/id');
    });

    it('does not duplicate an id that is already pinned', async () => {
      makeDownloadSpy(service, {
        ok: true,
        body: JSON.stringify({
          version: 1,
          pinnedConversationIds: ['conversations/bucket/id'],
        }),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updatePin(
        'conversations/bucket/id',
        true,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      const ids = (uploaded as { pinnedConversationIds: string[] })
        .pinnedConversationIds;
      expect(ids.filter((id) => id === 'conversations/bucket/id')).toHaveLength(
        1,
      );
    });

    it('removes an id when unpinning', async () => {
      makeDownloadSpy(service, {
        ok: true,
        body: JSON.stringify({
          version: 1,
          pinnedConversationIds: ['conversations/bucket/id'],
        }),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updatePin(
        'conversations/bucket/id',
        false,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect(
        (uploaded as { pinnedConversationIds: string[] }).pinnedConversationIds,
      ).not.toContain('conversations/bucket/id');
    });

    it('is a no-op unpin when id is not in the list', async () => {
      makeDownloadSpy(service, {
        ok: true,
        body: JSON.stringify({ version: 1, pinnedConversationIds: [] }),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updatePin(
        'conversations/bucket/not-there',
        false,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect(
        (uploaded as { pinnedConversationIds: string[] }).pinnedConversationIds,
      ).toHaveLength(0);
    });
  });
});

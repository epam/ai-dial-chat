import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import type { DialClientService } from '../../dial/dial-client.service';
import {
  DEFAULT_USER_CONFIG,
  UserConfig,
  migrateConfig,
} from '../dto/user-config.dto';
import { UserConfigService } from '../user-config.service';

vi.mock('../../common/dial/dial-error.mapper', () => ({
  handleDialSdkError: vi.fn(),
}));

const makeDialClient = () =>
  ({
    client: {
      downloadFile: vi.fn(),
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
    },
    baseUrl: 'http://localhost:3000',
    dialApiVersion: '2024-10-21',
  }) as unknown as DialClientService;

const makeDownloadSpy = (
  service: UserConfigService,
  responses: Array<{ path?: string; ok: boolean; body?: string }>,
) => {
  let callIndex = 0;
  return vi
    .spyOn(service['dialClient'].client, 'downloadFile')
    .mockImplementation(async (_bucket: unknown, path: unknown) => {
      const pathStr = path as string;
      // Find a matching response by path, or use the current call index
      const match = responses.find((r) => r.path === pathStr);
      if (match) {
        return {
          response: {
            ok: match.ok,
            text: async () => match.body ?? '',
          },
        } as never;
      }
      const r = responses[callIndex] ?? { ok: false };
      callIndex++;
      return {
        response: {
          ok: r.ok,
          text: async () => r.body ?? '',
        },
      } as never;
    });
};

const makeSingleDownloadSpy = (
  service: UserConfigService,
  options: { ok: boolean; body?: string },
) =>
  vi.spyOn(service['dialClient'].client, 'downloadFile').mockResolvedValue({
    response: {
      ok: options.ok,
      text: async () => options.body ?? '',
    },
  } as never);

const makeUploadSpy = (
  service: UserConfigService,
  options: { error?: unknown; status?: number } = {},
) =>
  vi.spyOn(service['dialClient'].client, 'uploadFile').mockResolvedValue({
    error: options.error,
    response: {
      status: options.status ?? 200,
      text: async () => (options.error ? 'error body' : ''),
    },
  } as never);

const makeDeleteSpy = (service: UserConfigService) =>
  vi.spyOn(service['dialClient'].client, 'deleteFile').mockResolvedValue({
    response: { ok: true },
  } as never);

const getUploadedConfig = async (uploadSpy: ReturnType<typeof vi.spyOn>) => {
  const formData = (uploadSpy.mock.calls[0] as unknown[])[2] as {
    body: FormData;
  };
  const file = formData.body.get('file') as Blob;
  return JSON.parse(await file.text()) as unknown;
};

/* Stored v2 shape — predates the `prompts` section entirely. */
const v2Config = (
  overrides?: Partial<UserConfig>,
): Omit<UserConfig, 'prompts'> => ({
  version: 2,
  conversations: { pinnedIds: [] },
  toolsets: { installed: [] },
  deployments: { installed: [], selectedId: null },
  ...overrides,
});

const v4Config = (overrides?: Partial<UserConfig>): UserConfig => ({
  version: 4,
  conversations: { pinnedIds: [] },
  toolsets: { installed: [] },
  deployments: { installed: [], selectedId: null },
  prompts: { installed: [] },
  legacyMigrationDone: true,
  ...overrides,
});

describe('migrateConfig', () => {
  it('returns the default config for null input', () => {
    expect(migrateConfig(null)).toEqual(DEFAULT_USER_CONFIG);
  });

  it('returns the default config for non-object input', () => {
    expect(migrateConfig('string')).toEqual(DEFAULT_USER_CONFIG);
    expect(migrateConfig(42)).toEqual(DEFAULT_USER_CONFIG);
  });

  it('lifts v1 flat shape into v4 with selectedId null', () => {
    const v1 = { version: 1, pinnedConversationIds: ['conv-1', 'conv-2'] };
    expect(migrateConfig(v1)).toEqual({
      version: 4,
      conversations: { pinnedIds: ['conv-1', 'conv-2'] },
      toolsets: { installed: [] },
      deployments: { installed: [], selectedId: null },
      prompts: { installed: [] },
    });
  });

  it('lifts v1 shape without version field', () => {
    const v1 = { pinnedConversationIds: ['conv-1'] };
    expect(migrateConfig(v1)).toEqual({
      version: 4,
      conversations: { pinnedIds: ['conv-1'] },
      toolsets: { installed: [] },
      deployments: { installed: [], selectedId: null },
      prompts: { installed: [] },
    });
  });

  it('filters non-string entries in pinnedConversationIds during v1→v4 lift', () => {
    const v1 = { pinnedConversationIds: ['valid', 42, null, 'also-valid'] };
    const result = migrateConfig(v1);
    expect(result.conversations.pinnedIds).toEqual(['valid', 'also-valid']);
  });

  it('migrates v2 shape to v4 adding selectedId null and empty prompts', () => {
    const stored = v2Config({ conversations: { pinnedIds: ['conv-1'] } });
    expect(migrateConfig(stored)).toEqual({
      version: 4,
      conversations: { pinnedIds: ['conv-1'] },
      toolsets: { installed: [] },
      deployments: { installed: [], selectedId: null },
      prompts: { installed: [] },
    });
  });

  it('passes through v4 shape with selectedId preserved', () => {
    const stored = v4Config({
      conversations: { pinnedIds: ['conv-1'] },
      deployments: { installed: ['dep-a'], selectedId: 'gpt-4o' },
    });
    expect(migrateConfig(stored)).toEqual(stored);
  });

  it('preserves favorited prompt paths', () => {
    const stored = v4Config({
      prompts: { installed: ['Work/AI/summarize', 'tone of voice'] },
    });
    expect(migrateConfig(stored).prompts.installed).toEqual([
      'Work/AI/summarize',
      'tone of voice',
    ]);
  });

  it('sanitises non-string entries in prompts.installed', () => {
    const corrupt = { version: 3, prompts: { installed: ['ok', 7, null] } };
    expect(migrateConfig(corrupt).prompts.installed).toEqual(['ok']);
  });

  it('sanitises non-string entries in v2 arrays and migrates to v4', () => {
    const corrupt = {
      version: 2,
      conversations: { pinnedIds: ['valid', 42, null] },
      toolsets: { installed: [] },
      deployments: { installed: [] },
    };
    const result = migrateConfig(corrupt);
    expect(result.conversations.pinnedIds).toEqual(['valid']);
    expect(result.version).toBe(4);
    expect(result.deployments.selectedId).toBeNull();
  });

  it('fills missing sections with empty arrays for v2+ shape', () => {
    const partial = { version: 2, conversations: { pinnedIds: ['x'] } };
    const result = migrateConfig(partial);
    expect(result.toolsets.installed).toEqual([]);
    expect(result.deployments.installed).toEqual([]);
    expect(result.deployments.selectedId).toBeNull();
    expect(result.prompts.installed).toEqual([]);
  });
});

describe('UserConfigService', () => {
  let service: UserConfigService;

  beforeEach(() => {
    service = new UserConfigService(makeDialClient());
    vi.mocked(handleDialSdkError).mockReset();
  });

  describe('readConfig', () => {
    it('returns the default config when both paths return non-ok', async () => {
      vi.spyOn(service['dialClient'].client, 'downloadFile').mockResolvedValue({
        response: { ok: false, text: async () => '' },
      } as never);
      makeDeleteSpy(service);
      const result = await service.readConfig('token', 'bucket');
      expect(result).toEqual(DEFAULT_USER_CONFIG);
    });

    it('migrates stored v2 config to v4 when reading from new path', async () => {
      const stored = v2Config({ conversations: { pinnedIds: ['conv-1'] } });
      makeDownloadSpy(service, [
        {
          path: '.client_data/.user-config.json',
          ok: true,
          body: JSON.stringify(stored),
        },
        { path: 'clientdata/installed_toolsets.json', ok: false },
        { path: 'clientdata/installed_deployments.json', ok: false },
      ]);
      makeUploadSpy(service);
      const result = await service.readConfig('token', 'bucket');
      expect(result).toEqual(
        v4Config({ conversations: { pinnedIds: ['conv-1'] } }),
      );
    });

    it('falls back to legacy path when new path returns non-ok', async () => {
      const v1 = { version: 1, pinnedConversationIds: ['conv-1'] };
      makeDownloadSpy(service, [
        { path: '.client_data/.user-config.json', ok: false },
        { path: '.user-config.json', ok: true, body: JSON.stringify(v1) },
        { path: 'clientdata/installed_toolsets.json', ok: false },
        { path: 'clientdata/installed_deployments.json', ok: false },
      ]);
      const uploadSpy = makeUploadSpy(service);
      makeDeleteSpy(service);

      const result = await service.readConfig('token', 'bucket');
      expect(result.conversations.pinnedIds).toEqual(['conv-1']);
      expect(result.version).toBe(4);
      expect(uploadSpy).toHaveBeenCalled();
    });

    it('returns default config on JSON parse error', async () => {
      makeDownloadSpy(service, [
        {
          path: '.client_data/.user-config.json',
          ok: true,
          body: 'not valid json{',
        },
        { path: 'clientdata/installed_toolsets.json', ok: false },
        { path: 'clientdata/installed_deployments.json', ok: false },
      ]);
      makeDeleteSpy(service);
      const result = await service.readConfig('token', 'bucket');
      expect(result).toEqual(DEFAULT_USER_CONFIG);
    });

    it('returns default config when downloadFile throws', async () => {
      vi.spyOn(service['dialClient'].client, 'downloadFile').mockRejectedValue(
        new Error('network'),
      );
      const result = await service.readConfig('token', 'bucket');
      expect(result).toEqual(DEFAULT_USER_CONFIG);
    });

    it('filters out non-string entries in conversations.pinnedIds during migration', async () => {
      const corrupt = {
        version: 2,
        conversations: { pinnedIds: ['valid', 42, null, 'also-valid'] },
        toolsets: { installed: [] },
        deployments: { installed: [] },
      };
      makeDownloadSpy(service, [
        {
          path: '.client_data/.user-config.json',
          ok: true,
          body: JSON.stringify(corrupt),
        },
        { path: 'clientdata/installed_toolsets.json', ok: false },
        { path: 'clientdata/installed_deployments.json', ok: false },
      ]);
      makeUploadSpy(service);
      const result = await service.readConfig('token', 'bucket');
      expect(result.conversations.pinnedIds).toEqual(['valid', 'also-valid']);
    });

    describe('legacy installation file consolidation', () => {
      it('merges legacy toolsets file into config', async () => {
        const stored = v2Config();
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          {
            path: 'clientdata/installed_toolsets.json',
            ok: true,
            body: '["toolset-a","toolset-b"]',
          },
          { path: 'clientdata/installed_deployments.json', ok: false },
        ]);
        const uploadSpy = makeUploadSpy(service);
        makeDeleteSpy(service);

        const result = await service.readConfig('token', 'bucket');
        expect(result.toolsets.installed).toEqual(['toolset-a', 'toolset-b']);
        expect(uploadSpy).toHaveBeenCalled();
      });

      it('merges legacy deployments file into config', async () => {
        const stored = v2Config();
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          { path: 'clientdata/installed_toolsets.json', ok: false },
          {
            path: 'clientdata/installed_deployments.json',
            ok: true,
            body: '["dep-1"]',
          },
        ]);
        const uploadSpy = makeUploadSpy(service);
        makeDeleteSpy(service);

        const result = await service.readConfig('token', 'bucket');
        expect(result.deployments.installed).toEqual(['dep-1']);
        expect(uploadSpy).toHaveBeenCalled();
      });

      it('new-config-wins: does not duplicate IDs already in base', async () => {
        const stored = v2Config({ toolsets: { installed: ['ts-a'] } });
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          {
            path: 'clientdata/installed_toolsets.json',
            ok: true,
            body: '["ts-a","ts-b"]',
          },
          { path: 'clientdata/installed_deployments.json', ok: false },
        ]);
        const uploadSpy = makeUploadSpy(service);
        makeDeleteSpy(service);

        const result = await service.readConfig('token', 'bucket');
        expect(result.toolsets.installed).toEqual(['ts-a', 'ts-b']);
        expect(
          result.toolsets.installed.filter((id) => id === 'ts-a'),
        ).toHaveLength(1);
        expect(uploadSpy).toHaveBeenCalled();
      });

      it('writes config to set legacyMigrationDone even when legacy files are absent', async () => {
        const stored = v2Config({ conversations: { pinnedIds: ['conv-1'] } });
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          { path: 'clientdata/installed_toolsets.json', ok: false },
          { path: 'clientdata/installed_deployments.json', ok: false },
        ]);
        const uploadSpy = makeUploadSpy(service);

        const result = await service.readConfig('token', 'bucket');
        expect(result.legacyMigrationDone).toBe(true);
        expect(uploadSpy).toHaveBeenCalledOnce();
      });

      it('writes config to set legacyMigrationDone even when legacy file is empty array', async () => {
        const stored = v2Config();
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          { path: 'clientdata/installed_toolsets.json', ok: true, body: '[]' },
          { path: 'clientdata/installed_deployments.json', ok: false },
        ]);
        const uploadSpy = makeUploadSpy(service);
        makeDeleteSpy(service);

        const result = await service.readConfig('token', 'bucket');
        expect(result.legacyMigrationDone).toBe(true);
        expect(uploadSpy).toHaveBeenCalledOnce();
      });

      it('writes config to set legacyMigrationDone even when legacy IDs fully overlap with base', async () => {
        const stored = v2Config({ toolsets: { installed: ['ts-a', 'ts-b'] } });
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          {
            path: 'clientdata/installed_toolsets.json',
            ok: true,
            body: '["ts-a","ts-b"]',
          },
          { path: 'clientdata/installed_deployments.json', ok: false },
        ]);
        const uploadSpy = makeUploadSpy(service);
        makeDeleteSpy(service);

        const result = await service.readConfig('token', 'bucket');
        expect(result.legacyMigrationDone).toBe(true);
        expect(
          result.toolsets.installed.filter((id) => id === 'ts-a'),
        ).toHaveLength(1);
        expect(uploadSpy).toHaveBeenCalledOnce();
      });

      it('logs warning and skips malformed legacy file', async () => {
        const stored = v2Config();
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          {
            path: 'clientdata/installed_toolsets.json',
            ok: true,
            body: '{bad json',
          },
          { path: 'clientdata/installed_deployments.json', ok: false },
        ]);
        const uploadSpy = makeUploadSpy(service);
        const warnSpy = vi.spyOn(service['logger'], 'warn');

        const result = await service.readConfig('token', 'bucket');
        expect(result.toolsets.installed).toEqual([]);
        expect(result.legacyMigrationDone).toBe(true);
        expect(uploadSpy).toHaveBeenCalledOnce();
        expect(warnSpy).toHaveBeenCalled();
      });

      it('logs warning and skips legacy file that is not an array', async () => {
        const stored = v2Config();
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          {
            path: 'clientdata/installed_toolsets.json',
            ok: true,
            body: '"not-an-array"',
          },
          { path: 'clientdata/installed_deployments.json', ok: false },
        ]);
        const uploadSpy = makeUploadSpy(service);
        const warnSpy = vi.spyOn(service['logger'], 'warn');

        const result = await service.readConfig('token', 'bucket');
        expect(result.toolsets.installed).toEqual([]);
        expect(result.legacyMigrationDone).toBe(true);
        expect(uploadSpy).toHaveBeenCalledOnce();
        expect(warnSpy).toHaveBeenCalled();
      });

      it('filters non-string entries in legacy file before merging', async () => {
        const stored = v2Config();
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          {
            path: 'clientdata/installed_toolsets.json',
            ok: true,
            body: '["ts-valid",42,null,"ts-also-valid"]',
          },
          { path: 'clientdata/installed_deployments.json', ok: false },
        ]);
        const uploadSpy = makeUploadSpy(service);
        makeDeleteSpy(service);

        const result = await service.readConfig('token', 'bucket');
        expect(result.toolsets.installed).toEqual([
          'ts-valid',
          'ts-also-valid',
        ]);
        expect(uploadSpy).toHaveBeenCalled();
      });

      it('extracts ids from object-shaped entries like [{ id: "..." }]', async () => {
        const stored = v2Config();
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          { path: 'clientdata/installed_toolsets.json', ok: false },
          {
            path: 'clientdata/installed_deployments.json',
            ok: true,
            body: JSON.stringify([
              { id: 'dep-1' },
              { id: 'dep-2' },
              42,
              null,
              { notId: 'ignored' },
            ]),
          },
        ]);
        const uploadSpy = makeUploadSpy(service);
        makeDeleteSpy(service);

        const result = await service.readConfig('token', 'bucket');
        expect(result.deployments.installed).toEqual(['dep-1', 'dep-2']);
        expect(uploadSpy).toHaveBeenCalled();
      });

      it('preserves conversations section during installation file migration', async () => {
        const stored = v2Config({ conversations: { pinnedIds: ['conv-1'] } });
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          {
            path: 'clientdata/installed_toolsets.json',
            ok: true,
            body: '["ts-a"]',
          },
          { path: 'clientdata/installed_deployments.json', ok: false },
        ]);
        makeUploadSpy(service);
        makeDeleteSpy(service);

        const result = await service.readConfig('token', 'bucket');
        expect(result.conversations.pinnedIds).toEqual(['conv-1']);
        expect(result.toolsets.installed).toEqual(['ts-a']);
      });

      it('deletes legacy installation file after merging its contents', async () => {
        const stored = v2Config();
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          {
            path: 'clientdata/installed_toolsets.json',
            ok: true,
            body: '["ts-new"]',
          },
          { path: 'clientdata/installed_deployments.json', ok: false },
        ]);
        makeUploadSpy(service);
        const deleteSpy = makeDeleteSpy(service);

        await service.readConfig('token', 'bucket');
        expect(deleteSpy).toHaveBeenCalledWith(
          'bucket',
          'clientdata/installed_toolsets.json',
          expect.anything(),
        );
      });

      it('is idempotent when legacy file deletion fails (thrown error)', async () => {
        const stored = v2Config({ toolsets: { installed: ['ts-a'] } });
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          {
            path: 'clientdata/installed_toolsets.json',
            ok: true,
            body: '["ts-a"]',
          },
          { path: 'clientdata/installed_deployments.json', ok: false },
        ]);
        const uploadSpy = makeUploadSpy(service);
        vi.spyOn(service['dialClient'].client, 'deleteFile').mockRejectedValue(
          new Error('delete failed'),
        );

        /*
         * ts-a is already in base, legacy file also has ts-a → no new IDs merged,
         * but writeConfig is still called once to persist legacyMigrationDone flag
         */
        const result = await service.readConfig('token', 'bucket');
        expect(
          result.toolsets.installed.filter((id) => id === 'ts-a'),
        ).toHaveLength(1);
        expect(result.legacyMigrationDone).toBe(true);
        expect(uploadSpy).toHaveBeenCalledOnce();
      });

      it('is idempotent when legacy file deletion returns SDK error (non-throw)', async () => {
        const stored = v2Config({ toolsets: { installed: ['ts-a'] } });
        makeDownloadSpy(service, [
          {
            path: '.client_data/.user-config.json',
            ok: true,
            body: JSON.stringify(stored),
          },
          {
            path: 'clientdata/installed_toolsets.json',
            ok: true,
            body: '["ts-a"]',
          },
          { path: 'clientdata/installed_deployments.json', ok: false },
        ]);
        const uploadSpy = makeUploadSpy(service);
        vi.spyOn(service['dialClient'].client, 'deleteFile').mockResolvedValue({
          error: 'Forbidden',
          response: { status: 403, ok: false },
        } as never);

        // Even when delete returns an SDK error, readConfig should complete and write legacyMigrationDone
        const result = await service.readConfig('token', 'bucket');
        expect(
          result.toolsets.installed.filter((id) => id === 'ts-a'),
        ).toHaveLength(1);
        expect(result.legacyMigrationDone).toBe(true);
        expect(uploadSpy).toHaveBeenCalledOnce();
      });

      it('merges both legacy files when both exist without existing config', async () => {
        makeDownloadSpy(service, [
          { path: '.client_data/.user-config.json', ok: false },
          { path: '.user-config.json', ok: false },
          {
            path: 'clientdata/installed_toolsets.json',
            ok: true,
            body: '["ts-1"]',
          },
          {
            path: 'clientdata/installed_deployments.json',
            ok: true,
            body: '["dep-1"]',
          },
        ]);
        makeUploadSpy(service);
        makeDeleteSpy(service);

        const result = await service.readConfig('token', 'bucket');
        expect(result.toolsets.installed).toEqual(['ts-1']);
        expect(result.deployments.installed).toEqual(['dep-1']);
      });
    });
  });

  describe('writeConfig', () => {
    it('uploads the config as multipart FormData', async () => {
      const uploadSpy = makeUploadSpy(service);
      const config = v2Config({ conversations: { pinnedIds: ['id-1'] } });
      await service.writeConfig(config, 'token', 'bucket');
      expect(uploadSpy).toHaveBeenCalledWith(
        'bucket',
        '.client_data/.user-config.json',
        expect.any(Object),
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect(uploaded).toEqual(config);
    });

    it('calls handleDialSdkError when DIAL Core returns an error', async () => {
      makeUploadSpy(service, { error: 'bad', status: 400 });
      await service.writeConfig(DEFAULT_USER_CONFIG, 'token', 'bucket');
      expect(handleDialSdkError).toHaveBeenCalledWith(
        'bad',
        'user-config.writeConfig',
        expect.anything(),
        expect.objectContaining({ status: 400 }),
      );
    });

    it('re-throws when uploadFile itself throws', async () => {
      vi.spyOn(service['dialClient'].client, 'uploadFile').mockRejectedValue(
        new Error('network'),
      );
      await expect(
        service.writeConfig(DEFAULT_USER_CONFIG, 'token', 'bucket'),
      ).rejects.toThrow('network');
    });
  });

  describe('updatePin', () => {
    it('adds a new id when pinning', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(v4Config()),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updatePin(
        'conversations/bucket/id',
        true,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).conversations.pinnedIds).toContain(
        'conversations/bucket/id',
      );
    });

    it('does not duplicate an id that is already pinned', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(
          v2Config({
            conversations: { pinnedIds: ['conversations/bucket/id'] },
          }),
        ),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updatePin(
        'conversations/bucket/id',
        true,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      const ids = (uploaded as UserConfig).conversations.pinnedIds;
      expect(ids.filter((id) => id === 'conversations/bucket/id')).toHaveLength(
        1,
      );
    });

    it('removes an id when unpinning', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(
          v4Config({
            conversations: { pinnedIds: ['conversations/bucket/id'] },
          }),
        ),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updatePin(
        'conversations/bucket/id',
        false,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).conversations.pinnedIds).not.toContain(
        'conversations/bucket/id',
      );
    });

    it('is a no-op unpin when id is not in the list', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(v2Config()),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updatePin(
        'conversations/bucket/not-there',
        false,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).conversations.pinnedIds).toHaveLength(0);
    });
  });

  describe('updateInstalledToolset', () => {
    it('adds a toolset id when installing', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(v4Config()),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateInstalledToolset(
        'toolset-abc',
        true,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).toolsets.installed).toContain(
        'toolset-abc',
      );
    });

    it('does not duplicate a toolset id when already installed', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(
          v2Config({ toolsets: { installed: ['toolset-abc'] } }),
        ),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateInstalledToolset(
        'toolset-abc',
        true,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      const ids = (uploaded as UserConfig).toolsets.installed;
      expect(ids.filter((id) => id === 'toolset-abc')).toHaveLength(1);
    });

    it('removes a toolset id when uninstalling', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(
          v4Config({ toolsets: { installed: ['toolset-abc'] } }),
        ),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateInstalledToolset(
        'toolset-abc',
        false,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).toolsets.installed).not.toContain(
        'toolset-abc',
      );
    });

    it('is a no-op when uninstalling a missing toolset id', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(v2Config()),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateInstalledToolset(
        'toolset-missing',
        false,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).toolsets.installed).toHaveLength(0);
    });
  });

  describe('updateInstalledDeployment', () => {
    it('adds a deployment id when installing', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(v4Config()),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateInstalledDeployment(
        'dep-xyz',
        true,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).deployments.installed).toContain(
        'dep-xyz',
      );
    });

    it('does not duplicate a deployment id when already installed', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(
          v2Config({ deployments: { installed: ['dep-xyz'] } }),
        ),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateInstalledDeployment(
        'dep-xyz',
        true,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      const ids = (uploaded as UserConfig).deployments.installed;
      expect(ids.filter((id) => id === 'dep-xyz')).toHaveLength(1);
    });

    it('removes a deployment id when uninstalling', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(
          v4Config({
            deployments: { installed: ['dep-xyz'], selectedId: null },
          }),
        ),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateInstalledDeployment(
        'dep-xyz',
        false,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).deployments.installed).not.toContain(
        'dep-xyz',
      );
    });

    it('is a no-op when uninstalling a missing deployment id', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(v2Config()),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateInstalledDeployment(
        'dep-missing',
        false,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).deployments.installed).toHaveLength(0);
    });
  });

  describe('updateInstalledPrompt', () => {
    it('adds a prompt path when favoriting', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(v4Config()),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateInstalledPrompt(
        'Work/AI/summarize',
        true,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).prompts.installed).toEqual([
        'Work/AI/summarize',
      ]);
    });

    it('removes a prompt path when unfavoriting', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(
          v4Config({ prompts: { installed: ['Work/AI/summarize'] } }),
        ),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateInstalledPrompt(
        'Work/AI/summarize',
        false,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).prompts.installed).toHaveLength(0);
    });

    it('does not duplicate an already favorited prompt path', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(
          v4Config({ prompts: { installed: ['Work/AI/summarize'] } }),
        ),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateInstalledPrompt(
        'Work/AI/summarize',
        true,
        'token',
        'bucket',
      );
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).prompts.installed).toHaveLength(1);
    });

    it('leaves other sections untouched', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(
          v4Config({
            deployments: { installed: ['dep-a'], selectedId: 'gpt-4o' },
            conversations: { pinnedIds: ['conv-1'] },
          }),
        ),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateInstalledPrompt('summarize', true, 'token', 'bucket');
      const uploaded = (await getUploadedConfig(uploadSpy)) as UserConfig;
      expect(uploaded.deployments).toEqual({
        installed: ['dep-a'],
        selectedId: 'gpt-4o',
      });
      expect(uploaded.conversations.pinnedIds).toEqual(['conv-1']);
    });
  });

  describe('updateSelectedDeployment', () => {
    it('sets selectedId to the given id', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(v4Config()),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateSelectedDeployment('gpt-4o', 'token', 'bucket');
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).deployments.selectedId).toBe('gpt-4o');
    });

    it('sets selectedId to null when id is null', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(
          v4Config({ deployments: { installed: [], selectedId: 'old-dep' } }),
        ),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateSelectedDeployment(null, 'token', 'bucket');
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).deployments.selectedId).toBeNull();
    });

    it('preserves deployments.installed when updating selectedId', async () => {
      makeSingleDownloadSpy(service, {
        ok: true,
        body: JSON.stringify(
          v4Config({
            deployments: { installed: ['dep-a', 'dep-b'], selectedId: null },
          }),
        ),
      });
      const uploadSpy = makeUploadSpy(service);
      await service.updateSelectedDeployment('dep-a', 'token', 'bucket');
      const uploaded = await getUploadedConfig(uploadSpy);
      expect((uploaded as UserConfig).deployments.installed).toEqual([
        'dep-a',
        'dep-b',
      ]);
    });
  });
});

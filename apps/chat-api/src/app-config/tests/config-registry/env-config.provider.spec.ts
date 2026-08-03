import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { AppConfigEvalContext } from '../../app-config.types';
import { EnvConfigProvider } from '../../config-registry/env-config.provider';

const ctx: AppConfigEvalContext = { appId: 'chat-ui' };

function makeProvider(envOverrides: Partial<EnvironmentVariables> = {}) {
  const configService = {
    get: vi.fn(
      (key: string) => envOverrides[key as keyof EnvironmentVariables],
    ),
  } as unknown as ConfigService<EnvironmentVariables>;
  return { provider: new EnvConfigProvider(configService), configService };
}

describe('EnvConfigProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('asr.modelId', () => {
    it('returns the ASR model ID when ASR_MODEL is set', async () => {
      const { provider } = makeProvider({ ASR_MODEL: 'whisper-1' });
      expect(await provider.resolve('asr.modelId', ctx)).toBe('whisper-1');
    });

    it('returns undefined when ASR_MODEL is not set', async () => {
      const { provider } = makeProvider({ ASR_MODEL: undefined });
      expect(await provider.resolve('asr.modelId', ctx)).toBeUndefined();
    });
  });

  describe('asr.transcribeSizeLimitBytes', () => {
    it('returns the value when TRANSCRIBE_SIZE_LIMIT_BYTES is set', async () => {
      const { provider } = makeProvider({
        TRANSCRIBE_SIZE_LIMIT_BYTES: 10_485_760,
      });
      expect(await provider.resolve('asr.transcribeSizeLimitBytes', ctx)).toBe(
        10_485_760,
      );
    });

    it('returns undefined when TRANSCRIBE_SIZE_LIMIT_BYTES is not set', async () => {
      const { provider } = makeProvider({
        TRANSCRIBE_SIZE_LIMIT_BYTES: undefined,
      });
      expect(
        await provider.resolve('asr.transcribeSizeLimitBytes', ctx),
      ).toBeUndefined();
    });
  });

  describe('utility.modelId', () => {
    it('returns the utility model ID when UTILITY_MODEL is set', async () => {
      const { provider } = makeProvider({ UTILITY_MODEL: 'gpt-4o-mini' });
      expect(await provider.resolve('utility.modelId', ctx)).toBe(
        'gpt-4o-mini',
      );
    });

    it('returns undefined when UTILITY_MODEL is not set', async () => {
      const { provider } = makeProvider({ UTILITY_MODEL: undefined });
      expect(await provider.resolve('utility.modelId', ctx)).toBeUndefined();
    });
  });

  describe('features.llmConversationNaming', () => {
    it('returns true when UTILITY_MODEL is set and LLM_CONVERSATION_NAMING_ENABLED is true', async () => {
      const { provider } = makeProvider({
        UTILITY_MODEL: 'gpt-4o-mini',
        DIAL_API_KEY: 'dial-api-key',
        LLM_CONVERSATION_NAMING_ENABLED: true,
      });
      expect(
        await provider.resolve('features.llmConversationNaming', ctx),
      ).toBe(true);
    });

    it('returns false when UTILITY_MODEL is set but LLM_CONVERSATION_NAMING_ENABLED is false', async () => {
      const { provider } = makeProvider({
        UTILITY_MODEL: 'gpt-4o-mini',
        DIAL_API_KEY: 'dial-api-key',
        LLM_CONVERSATION_NAMING_ENABLED: false,
      });
      expect(
        await provider.resolve('features.llmConversationNaming', ctx),
      ).toBe(false);
    });

    it('returns undefined when UTILITY_MODEL is absent', async () => {
      const { provider } = makeProvider({
        UTILITY_MODEL: undefined,
        DIAL_API_KEY: 'dial-api-key',
        LLM_CONVERSATION_NAMING_ENABLED: true,
      });
      expect(
        await provider.resolve('features.llmConversationNaming', ctx),
      ).toBeUndefined();
    });

    it('returns undefined when DIAL_API_KEY is absent', async () => {
      const { provider } = makeProvider({
        UTILITY_MODEL: 'gpt-4o-mini',
        DIAL_API_KEY: undefined,
        LLM_CONVERSATION_NAMING_ENABLED: true,
      });
      expect(
        await provider.resolve('features.llmConversationNaming', ctx),
      ).toBeUndefined();
    });
  });

  describe('features.asrEnabled', () => {
    it('returns true when ASR_MODEL is set', async () => {
      const { provider } = makeProvider({ ASR_MODEL: 'whisper-1' });
      expect(await provider.resolve('features.asrEnabled', ctx)).toBe(true);
    });

    it('returns undefined when ASR_MODEL is absent', async () => {
      const { provider } = makeProvider({ ASR_MODEL: undefined });
      expect(
        await provider.resolve('features.asrEnabled', ctx),
      ).toBeUndefined();
    });

    describe('role gating via ASR_ENABLED_ROLES', () => {
      it('returns true when ASR_ENABLED_ROLES is empty (unrestricted)', async () => {
        const { provider } = makeProvider({
          ASR_MODEL: 'whisper-1',
          ASR_ENABLED_ROLES: [],
        });
        expect(await provider.resolve('features.asrEnabled', ctx)).toBe(true);
      });

      it('returns true when user has a matching role', async () => {
        const { provider } = makeProvider({
          ASR_MODEL: 'whisper-1',
          ASR_ENABLED_ROLES: ['admin', 'ml-team'],
        });
        const ctxWithRole: AppConfigEvalContext = {
          ...ctx,
          roles: ['ml-team'],
        };
        expect(await provider.resolve('features.asrEnabled', ctxWithRole)).toBe(
          true,
        );
      });

      it('returns false when user has no roles and ASR_ENABLED_ROLES is set', async () => {
        const { provider } = makeProvider({
          ASR_MODEL: 'whisper-1',
          ASR_ENABLED_ROLES: ['admin'],
        });
        expect(await provider.resolve('features.asrEnabled', ctx)).toBe(false);
      });

      it('returns false when user roles do not intersect with ASR_ENABLED_ROLES', async () => {
        const { provider } = makeProvider({
          ASR_MODEL: 'whisper-1',
          ASR_ENABLED_ROLES: ['admin'],
        });
        const ctxWithRole: AppConfigEvalContext = {
          ...ctx,
          roles: ['viewer'],
        };
        expect(await provider.resolve('features.asrEnabled', ctxWithRole)).toBe(
          false,
        );
      });
    });
  });

  describe('features.liveChatInteraction', () => {
    it('returns true when LIVE_CHAT_INTERACTION_ENABLED is true', async () => {
      const { provider } = makeProvider({
        LIVE_CHAT_INTERACTION_ENABLED: true,
      });
      expect(await provider.resolve('features.liveChatInteraction', ctx)).toBe(
        true,
      );
    });

    it('returns undefined when LIVE_CHAT_INTERACTION_ENABLED is absent', async () => {
      const { provider } = makeProvider({
        LIVE_CHAT_INTERACTION_ENABLED: undefined,
      });
      expect(
        await provider.resolve('features.liveChatInteraction', ctx),
      ).toBeUndefined();
    });

    describe('role gating via LIVE_CHAT_INTERACTION_ENABLED_ROLES', () => {
      it('returns true when the roles env var is empty (unrestricted)', async () => {
        const { provider } = makeProvider({
          LIVE_CHAT_INTERACTION_ENABLED: true,
          LIVE_CHAT_INTERACTION_ENABLED_ROLES: [],
        });
        expect(
          await provider.resolve('features.liveChatInteraction', ctx),
        ).toBe(true);
      });

      it('returns true when user has a matching role', async () => {
        const { provider } = makeProvider({
          LIVE_CHAT_INTERACTION_ENABLED: true,
          LIVE_CHAT_INTERACTION_ENABLED_ROLES: ['admin'],
        });
        const ctxWithRole: AppConfigEvalContext = { ...ctx, roles: ['admin'] };
        expect(
          await provider.resolve('features.liveChatInteraction', ctxWithRole),
        ).toBe(true);
      });

      it('returns false when user roles do not intersect with the allowed roles', async () => {
        const { provider } = makeProvider({
          LIVE_CHAT_INTERACTION_ENABLED: true,
          LIVE_CHAT_INTERACTION_ENABLED_ROLES: ['admin'],
        });
        const ctxWithRole: AppConfigEvalContext = {
          ...ctx,
          roles: ['viewer'],
        };
        expect(
          await provider.resolve('features.liveChatInteraction', ctxWithRole),
        ).toBe(false);
      });
    });
  });

  describe('features.scheduledTasksEnabled', () => {
    it('returns true when SCHEDULED_TASKS_ENABLED is true', async () => {
      const { provider } = makeProvider({
        SCHEDULED_TASKS_ENABLED: true,
      });
      expect(
        await provider.resolve('features.scheduledTasksEnabled', ctx),
      ).toBe(true);
    });

    it('returns undefined when SCHEDULED_TASKS_ENABLED is absent', async () => {
      const { provider } = makeProvider({
        SCHEDULED_TASKS_ENABLED: undefined,
      });
      expect(
        await provider.resolve('features.scheduledTasksEnabled', ctx),
      ).toBeUndefined();
    });

    describe('role gating via SCHEDULED_TASKS_ENABLED_ROLES', () => {
      it('returns true when the roles env var is empty (unrestricted)', async () => {
        const { provider } = makeProvider({
          SCHEDULED_TASKS_ENABLED: true,
          SCHEDULED_TASKS_ENABLED_ROLES: [],
        });
        expect(
          await provider.resolve('features.scheduledTasksEnabled', ctx),
        ).toBe(true);
      });

      it('returns true when user has a matching role', async () => {
        const { provider } = makeProvider({
          SCHEDULED_TASKS_ENABLED: true,
          SCHEDULED_TASKS_ENABLED_ROLES: ['admin'],
        });
        const ctxWithRole: AppConfigEvalContext = { ...ctx, roles: ['admin'] };
        expect(
          await provider.resolve('features.scheduledTasksEnabled', ctxWithRole),
        ).toBe(true);
      });

      it('returns false when user roles do not intersect with the allowed roles', async () => {
        const { provider } = makeProvider({
          SCHEDULED_TASKS_ENABLED: true,
          SCHEDULED_TASKS_ENABLED_ROLES: ['admin'],
        });
        const ctxWithRole: AppConfigEvalContext = {
          ...ctx,
          roles: ['viewer'],
        };
        expect(
          await provider.resolve('features.scheduledTasksEnabled', ctxWithRole),
        ).toBe(false);
      });
    });
  });

  describe('dialCore.externalUrl', () => {
    it('returns the external URL when DIAL_CORE_EXTERNAL_URL is set', async () => {
      const { provider } = makeProvider({
        DIAL_CORE_EXTERNAL_URL: 'https://dial.example.com',
      });
      expect(await provider.resolve('dialCore.externalUrl', ctx)).toBe(
        'https://dial.example.com',
      );
    });

    it('returns undefined when DIAL_CORE_EXTERNAL_URL is not set', async () => {
      const { provider } = makeProvider({ DIAL_CORE_EXTERNAL_URL: undefined });
      expect(
        await provider.resolve('dialCore.externalUrl', ctx),
      ).toBeUndefined();
    });
  });

  describe('fileManager.availableTabs', () => {
    it('returns undefined when FILE_MANAGER_AVAILABLE_TABS is not set', async () => {
      const { provider } = makeProvider({ FILE_MANAGER_AVAILABLE_TABS: [] });
      expect(
        await provider.resolve('fileManager.availableTabs', ctx),
      ).toBeUndefined();
    });

    it('returns the valid subset when a valid subset is configured', async () => {
      const { provider } = makeProvider({
        FILE_MANAGER_AVAILABLE_TABS: ['my_files', 'organization'],
      });
      expect(await provider.resolve('fileManager.availableTabs', ctx)).toEqual([
        'my_files',
        'organization',
      ]);
    });

    it('drops unknown ids and keeps only recognized tabs', async () => {
      const { provider } = makeProvider({
        FILE_MANAGER_AVAILABLE_TABS: ['my_files', 'review', 'bogus'],
      });
      expect(await provider.resolve('fileManager.availableTabs', ctx)).toEqual([
        'my_files',
      ]);
    });

    it('returns undefined when every configured id is invalid', async () => {
      const { provider } = makeProvider({
        FILE_MANAGER_AVAILABLE_TABS: ['review', 'bogus'],
      });
      expect(
        await provider.resolve('fileManager.availableTabs', ctx),
      ).toBeUndefined();
    });
  });

  describe('customVisualizers', () => {
    it('returns undefined when CUSTOM_VISUALIZERS is not set', async () => {
      const { provider } = makeProvider({ CUSTOM_VISUALIZERS: undefined });
      expect(await provider.resolve('customVisualizers', ctx)).toBeUndefined();
    });

    it('returns [] and logs an error when CUSTOM_VISUALIZERS is invalid JSON', async () => {
      const { provider } = makeProvider({ CUSTOM_VISUALIZERS: 'not-json' });
      const loggerErrorSpy = vi.spyOn(provider['logger'], 'error');

      expect(await provider.resolve('customVisualizers', ctx)).toEqual([]);
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('returns [] and logs an error when CUSTOM_VISUALIZERS is valid JSON but not an array', async () => {
      const { provider } = makeProvider({
        CUSTOM_VISUALIZERS: JSON.stringify({ contentType: 'x' }),
      });
      const loggerErrorSpy = vi.spyOn(provider['logger'], 'error');

      expect(await provider.resolve('customVisualizers', ctx)).toEqual([]);
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('accepts a valid entry and preserves its fields verbatim', async () => {
      const { provider } = makeProvider({
        CUSTOM_VISUALIZERS: JSON.stringify([
          {
            title: 'my-viz',
            description: 'my viz description',

            contentType: 'application/x-my-viz',
            url: 'https://viz.example.com',
          },
        ]),
      });

      expect(await provider.resolve('customVisualizers', ctx)).toEqual([
        {
          title: 'my-viz',
          description: 'my viz description',

          contentType: 'application/x-my-viz',
          url: 'https://viz.example.com',
          requestTimeout: undefined,
          passAuthInfo: undefined,
          passExplicitToken: undefined,
        },
      ]);
    });

    it('keeps other valid entries when one entry fails validation', async () => {
      const { provider } = makeProvider({
        CUSTOM_VISUALIZERS: JSON.stringify([
          {
            title: 'my-viz',

            contentType: 'application/x-my-viz',
            url: 'https://viz.example.com',
          },
          { contentType: '', url: 'not-a-url', title: 'bad', icon: 'x' },
        ]),
      });
      const loggerErrorSpy = vi.spyOn(provider['logger'], 'error');

      const result = (await provider.resolve(
        'customVisualizers',
        ctx,
      )) as unknown[];

      expect(result).toHaveLength(1);
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('drops an entry with a missing title', async () => {
      const { provider } = makeProvider({
        CUSTOM_VISUALIZERS: JSON.stringify([
          {
            contentType: 'application/x-my-viz',
            url: 'https://viz.example.com',
          },
        ]),
      });

      expect(await provider.resolve('customVisualizers', ctx)).toEqual([]);
    });

    it('accepts a whitespace-only title (some visualizers use spaces as appName)', async () => {
      const { provider } = makeProvider({
        CUSTOM_VISUALIZERS: JSON.stringify([
          {
            contentType: 'application/x-my-viz',
            url: 'https://viz.example.com',
            title: ' ',
          },
        ]),
      });

      const result = (await provider.resolve('customVisualizers', ctx)) as {
        title: string;
      }[];
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe(' ');
    });

    it('accepts a comma-separated contentType and stores it verbatim', async () => {
      const { provider } = makeProvider({
        CUSTOM_VISUALIZERS: JSON.stringify([
          {
            contentType: 'application/x-a, application/x-b',
            url: 'https://viz.example.com',
            title: 'multi',
          },
        ]),
      });

      const result = (await provider.resolve(
        'customVisualizers',
        ctx,
      )) as Array<{ contentType: string }>;
      expect(result[0].contentType).toBe('application/x-a, application/x-b');
    });

    it('keeps an entry with unrecognized fields, logging a warning listing them', async () => {
      const { provider } = makeProvider({
        CUSTOM_VISUALIZERS: JSON.stringify([
          {
            title: 'my-viz',
            contentType: 'application/x-my-viz',
            url: 'https://viz.example.com',
            width: 800,
            expanded: true,
          },
        ]),
      });
      const loggerWarnSpy = vi.spyOn(provider['logger'], 'warn');

      const result = (await provider.resolve(
        'customVisualizers',
        ctx,
      )) as Array<Record<string, unknown>>;

      expect(result).toHaveLength(1);
      expect(result[0].width).toBe(800);
      expect(result[0]).not.toHaveProperty('expanded');
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('expanded'),
      );
    });
  });

  describe('unknown key', () => {
    it('returns undefined for an unknown key', async () => {
      const { provider } = makeProvider();
      expect(await provider.resolve('not.a.key', ctx)).toBeUndefined();
    });
  });

  describe('type mismatch', () => {
    it('returns undefined and logs a warning when the number value is NaN', async () => {
      const configService = {
        get: vi.fn((key: string) => {
          if (key === 'TRANSCRIBE_SIZE_LIMIT_BYTES') return NaN;
          return undefined;
        }),
      } as unknown as ConfigService<EnvironmentVariables>;
      const provider = new EnvConfigProvider(configService);
      const loggerWarnSpy = vi.spyOn(provider['logger'], 'warn');

      const result = await provider.resolve(
        'asr.transcribeSizeLimitBytes',
        ctx,
      );

      expect(result).toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalled();
    });
  });
});

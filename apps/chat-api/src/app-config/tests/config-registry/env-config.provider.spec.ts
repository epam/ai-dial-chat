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
  it('resolves external connection origins from the existing CSP configuration', async () => {
    const origins = ['https://documents.example.com', 'https://*.example.org'];
    const { provider } = makeProvider({ ALLOWED_CONNECT_ORIGINS: origins });
    expect(
      await provider.resolve('documents.allowedConnectOrigins', ctx),
    ).toEqual(origins);
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('customVariables', () => {
    it('preserves arbitrary JSON values without interpreting client keys', async () => {
      const variables = {
        label: 'Example',
        count: 3,
        enabled: false,
        nested: { list: [1, null, 'x'] },
      };
      const { provider } = makeProvider({
        CUSTOM_CLIENT_VARIABLES: JSON.stringify(variables),
      });
      expect(await provider.resolve('customVariables', ctx)).toEqual(variables);
    });
    it.each([
      undefined,
      '',
      ' ',
      '{invalid',
      '[]',
      'null',
      '42',
      'true',
      '"string"',
    ])('falls back for unset or invalid JSON object %j', async (raw) => {
      const { provider } = makeProvider({ CUSTOM_CLIENT_VARIABLES: raw });
      expect(await provider.resolve('customVariables', ctx)).toBeUndefined();
    });
    it('accepts an explicitly empty object', async () => {
      const { provider } = makeProvider({ CUSTOM_CLIENT_VARIABLES: '{}' });
      expect(await provider.resolve('customVariables', ctx)).toEqual({});
    });
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

  describe('features.responsesApiEnabled', () => {
    it('returns true when RESPONSES_API_ENABLED is true', async () => {
      const { provider } = makeProvider({ RESPONSES_API_ENABLED: true });
      expect(await provider.resolve('features.responsesApiEnabled', ctx)).toBe(
        true,
      );
    });

    it('returns false when RESPONSES_API_ENABLED is false', async () => {
      const { provider } = makeProvider({ RESPONSES_API_ENABLED: false });
      expect(await provider.resolve('features.responsesApiEnabled', ctx)).toBe(
        false,
      );
    });

    it('returns undefined when RESPONSES_API_ENABLED is absent (falls through to the registry default of false)', async () => {
      const { provider } = makeProvider({ RESPONSES_API_ENABLED: undefined });
      expect(
        await provider.resolve('features.responsesApiEnabled', ctx),
      ).toBeUndefined();
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

  describe('announcement.items', () => {
    const ENTRY = {
      title: 'We have upgraded to DIAL 1.43',
      description: "Check what's new:",
      link: { label: 'Changelog', href: 'https://dialx.ai/changelog' },
    };

    it('returns undefined when ANNOUNCEMENTS is not set', async () => {
      const { provider } = makeProvider({ ANNOUNCEMENTS: undefined });
      expect(await provider.resolve('announcement.items', ctx)).toBeUndefined();
    });

    /* Regression: the generic env path returns the raw string for a 'json'
     * valueType, which reached the service as a string and silently resolved
     * to an empty list. */
    it('parses a JSON array into an array rather than passing the string through', async () => {
      const { provider } = makeProvider({
        ANNOUNCEMENTS: JSON.stringify([ENTRY]),
      });

      const resolved = await provider.resolve('announcement.items', ctx);

      expect(Array.isArray(resolved)).toBe(true);
      expect(resolved).toEqual([ENTRY]);
    });

    it('returns undefined and logs an error when ANNOUNCEMENTS is invalid JSON', async () => {
      const { provider } = makeProvider({ ANNOUNCEMENTS: 'not-json' });
      const loggerErrorSpy = vi.spyOn(provider['logger'], 'error');

      expect(await provider.resolve('announcement.items', ctx)).toBeUndefined();
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('returns undefined and logs an error when ANNOUNCEMENTS is not an array', async () => {
      const { provider } = makeProvider({
        ANNOUNCEMENTS: JSON.stringify(ENTRY),
      });
      const loggerErrorSpy = vi.spyOn(provider['logger'], 'error');

      expect(await provider.resolve('announcement.items', ctx)).toBeUndefined();
      expect(loggerErrorSpy).toHaveBeenCalled();
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

  describe('publish.publicationFilterSources', () => {
    it('returns undefined when PUBLICATION_FILTER_SOURCES is not set', async () => {
      const { provider } = makeProvider({ PUBLICATION_FILTER_SOURCES: [] });
      expect(
        await provider.resolve('publish.publicationFilterSources', ctx),
      ).toBeUndefined();
    });

    it('returns the parsed, trimmed array when PUBLICATION_FILTER_SOURCES is set', async () => {
      const { provider } = makeProvider({
        PUBLICATION_FILTER_SOURCES: ['roles', 'department', 'title'],
      });
      expect(
        await provider.resolve('publish.publicationFilterSources', ctx),
      ).toEqual(['roles', 'department', 'title']);
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

  describe('applicationVisualizers', () => {
    const validEntry = {
      title: 'my-viz',
      url: 'https://viz.example.com',
    };

    it('returns undefined when APPLICATION_VISUALIZERS is not set', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: undefined,
      });
      expect(
        await provider.resolve('applicationVisualizers', ctx),
      ).toBeUndefined();
    });

    it('returns {} and logs an error when APPLICATION_VISUALIZERS is invalid JSON', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: 'not-json',
      });
      const loggerErrorSpy = vi.spyOn(provider['logger'], 'error');

      expect(await provider.resolve('applicationVisualizers', ctx)).toEqual({});
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('returns {} and logs an error when the value is a JSON array', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: JSON.stringify([validEntry]),
      });
      const loggerErrorSpy = vi.spyOn(provider['logger'], 'error');

      expect(await provider.resolve('applicationVisualizers', ctx)).toEqual({});
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('must be a JSON object'),
      );
    });

    it('resolves a valid entry keyed by application id', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: JSON.stringify({ 'app-1': validEntry }),
      });

      const result = (await provider.resolve(
        'applicationVisualizers',
        ctx,
      )) as Record<string, { title: string; url: string }>;

      expect(Object.keys(result)).toEqual(['app-1']);
      expect(result['app-1'].title).toBe('my-viz');
      expect(result['app-1'].url).toBe('https://viz.example.com');
    });

    it('accepts an entry without contentType', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: JSON.stringify({ 'app-1': validEntry }),
      });

      const result = (await provider.resolve(
        'applicationVisualizers',
        ctx,
      )) as Record<string, { contentType?: string }>;

      expect(result['app-1'].contentType).toBeUndefined();
    });

    it('keeps the other entries when one fails validation', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: JSON.stringify({
          'app-1': validEntry,
          'app-2': { title: 'bad-viz', url: 'not-a-url' },
        }),
      });
      const loggerErrorSpy = vi.spyOn(provider['logger'], 'error');

      const result = (await provider.resolve(
        'applicationVisualizers',
        ctx,
      )) as Record<string, unknown>;

      expect(Object.keys(result)).toEqual(['app-1']);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('app-2'),
      );
    });

    it('drops an entry whose value is not an object', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: JSON.stringify({ 'app-1': 'nope' }),
      });
      const loggerErrorSpy = vi.spyOn(provider['logger'], 'error');

      expect(await provider.resolve('applicationVisualizers', ctx)).toEqual({});
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('is not an object'),
      );
    });

    it('drops an entry whose declared contentType has no usable MIME type', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: JSON.stringify({
          'app-1': { ...validEntry, contentType: ' , ' },
        }),
      });
      const loggerErrorSpy = vi.spyOn(provider['logger'], 'error');

      expect(await provider.resolve('applicationVisualizers', ctx)).toEqual({});
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('no usable MIME type'),
      );
    });

    it('accepts a whitespace-only title without trimming it', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: JSON.stringify({
          'app-1': { ...validEntry, title: ' ' },
        }),
      });
      const loggerErrorSpy = vi.spyOn(provider['logger'], 'error');

      const result = (await provider.resolve(
        'applicationVisualizers',
        ctx,
      )) as Record<string, { title: string }>;

      expect(result['app-1'].title).toBe(' ');
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('drops an entry with an empty-string title', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: JSON.stringify({
          'app-1': { ...validEntry, title: '' },
        }),
      });

      expect(await provider.resolve('applicationVisualizers', ctx)).toEqual({});
    });

    it('warns about unrecognized fields but keeps the entry', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: JSON.stringify({
          'app-1': { ...validEntry, expanded: true },
        }),
      });
      const loggerWarnSpy = vi.spyOn(provider['logger'], 'warn');

      const result = (await provider.resolve(
        'applicationVisualizers',
        ctx,
      )) as Record<string, unknown>;

      expect(Object.keys(result)).toEqual(['app-1']);
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('expanded'),
      );
    });

    it('warns when the entry origin is absent from ALLOWED_IFRAME_ORIGINS', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: JSON.stringify({ 'app-1': validEntry }),
        ALLOWED_IFRAME_ORIGINS: ['https://other.example.com'],
      });
      const loggerWarnSpy = vi.spyOn(provider['logger'], 'warn');

      const result = (await provider.resolve(
        'applicationVisualizers',
        ctx,
      )) as Record<string, unknown>;

      expect(Object.keys(result)).toEqual(['app-1']);
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('ALLOWED_IFRAME_ORIGINS'),
      );
    });

    it('does not warn when the entry origin is allowlisted', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: JSON.stringify({ 'app-1': validEntry }),
        ALLOWED_IFRAME_ORIGINS: ['https://viz.example.com'],
      });
      const loggerWarnSpy = vi.spyOn(provider['logger'], 'warn');

      await provider.resolve('applicationVisualizers', ctx);

      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });

    it('does not warn when a wildcard allowlist entry covers the origin', async () => {
      const { provider } = makeProvider({
        APPLICATION_VISUALIZERS: JSON.stringify({ 'app-1': validEntry }),
        ALLOWED_IFRAME_ORIGINS: ['https://*.example.com'],
      });
      const loggerWarnSpy = vi.spyOn(provider['logger'], 'warn');

      await provider.resolve('applicationVisualizers', ctx);

      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });
  });
});

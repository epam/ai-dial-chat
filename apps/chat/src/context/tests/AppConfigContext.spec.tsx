import {
  CatalogCreationType,
  type ClientConfigResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as appConfigApi from '../../server-api/app-config.api';
import { AuthStatus } from '../../types/auth-status';
import { UserConfigStatus } from '../../types/user-config-status';
import AppConfigProvider, {
  useAppConfig,
  useFeatureFlag,
} from '../AppConfigContext';

vi.mock('../../server-api/app-config.api');
/* Mutable so a test can switch the session and rerender the provider. */
const mockSession = vi.hoisted(() => ({
  current: {
    user: null as { sub: string; providerId: string; claims: object } | null,
    status: 'authenticated',
  },
}));

vi.mock('../auth/UserContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/UserContext')>();
  return {
    ...actual,
    useUser: () => ({
      ...mockSession.current,
      refresh: vi.fn(),
      reset: vi.fn(),
    }),
  };
});

const mockGetClientConfig = vi.mocked(appConfigApi.getClientConfig);

const READY_RESPONSE = {
  appId: 'chat-ui',
  features: { asrEnabled: true },
  config: {
    asrModelId: 'whisper-1',
    transcribeSizeLimitBytes: 10_485_760,
    dialCoreExternalUrl: 'https://dial.example.com',
  },
  metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
} as unknown as ClientConfigResponseDto;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(AppConfigProvider, null, children);

describe('AppConfigContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.current = { user: null, status: AuthStatus.Authenticated };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in loading state', () => {
    mockGetClientConfig.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useAppConfig(), { wrapper });
    expect(result.current.status).toBe(UserConfigStatus.Loading);
    expect(result.current.config.activeEventId).toBeNull();
    expect(result.current.config.dialCoreExternalUrl).toBeNull();
    expect(result.current.config.fileManagerTabs).toEqual([
      'all',
      'my_files',
      'shared',
      'organization',
    ]);
    expect(result.current.config.overlayEnabled).toBe(false);
    expect(result.current.config.overlayAllowedOrigins).toEqual([]);
    expect(result.current.config.allowedConnectOrigins).toEqual([]);
    expect(result.current.config.enabledUiFeatures).toBeNull();
    expect(result.current.config.announcementHtml).toBeNull();
    expect(result.current.config.customVisualizers).toEqual([]);
  });

  it('transitions to ready after successful API call', async () => {
    mockGetClientConfig.mockResolvedValue(READY_RESPONSE);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.features['asrEnabled']).toBe(true);
    expect(result.current.config.asrModelId).toBe('whisper-1');
    expect(result.current.config.dialCoreExternalUrl).toBe(
      'https://dial.example.com',
    );
  });

  it.each(['halloween', 'new-year', 'product-launch-2027', null])(
    'preserves the event selection %s from client-config',
    async (activeEventId) => {
      mockGetClientConfig.mockResolvedValue({
        ...READY_RESPONSE,
        config: { ...READY_RESPONSE.config, activeEventId },
      });
      const { result } = renderHook(() => useAppConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.config.activeEventId).toBe(activeEventId);
    },
  );

  it('disables celebrations when a backend response omits event selection', async () => {
    mockGetClientConfig.mockResolvedValue(READY_RESPONSE);
    const { result } = renderHook(() => useAppConfig(), { wrapper });
    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );
    expect(result.current.config.activeEventId).toBeNull();
  });

  it('defaults celebrationsEnabledByDefault to true when the response omits it', async () => {
    mockGetClientConfig.mockResolvedValue(READY_RESPONSE);
    const { result } = renderHook(() => useAppConfig(), { wrapper });
    expect(result.current.config.celebrationsEnabledByDefault).toBe(true);
    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );
    expect(result.current.config.celebrationsEnabledByDefault).toBe(true);
  });

  it('passes an operator-disabled celebrationsEnabledByDefault through', async () => {
    mockGetClientConfig.mockResolvedValue({
      ...READY_RESPONSE,
      config: { ...READY_RESPONSE.config, celebrationsEnabledByDefault: false },
    });
    const { result } = renderHook(() => useAppConfig(), { wrapper });
    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );
    expect(result.current.config.celebrationsEnabledByDefault).toBe(false);
  });

  it('populates overlayEnabled/overlayAllowedOrigins from a successful API call', async () => {
    mockGetClientConfig.mockResolvedValue({
      appId: 'chat-ui',
      features: { asrEnabled: false },
      config: {
        asrModelId: null,
        transcribeSizeLimitBytes: 5_242_880,
        dialCoreExternalUrl: null,
        overlayEnabled: true,
        overlayAllowedOrigins: ['https://partner.example.com'],
        allowedConnectOrigins: ['https://documents.example.com'],
      },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.config.overlayEnabled).toBe(true);
    expect(result.current.config.allowedConnectOrigins).toEqual([
      'https://documents.example.com',
    ]);
    expect(result.current.config.overlayAllowedOrigins).toEqual([
      'https://partner.example.com',
    ]);
  });

  it('reflects a narrowed fileManagerTabs value once the config resolves', async () => {
    mockGetClientConfig.mockResolvedValue({
      appId: 'chat-ui',
      features: { asrEnabled: false },
      config: {
        asrModelId: null,
        transcribeSizeLimitBytes: 5_242_880,
        dialCoreExternalUrl: null,
        fileManagerTabs: ['my_files', 'organization'],
      },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.config.fileManagerTabs).toEqual([
      'my_files',
      'organization',
    ]);
  });

  it('transitions to error after API call failure', async () => {
    mockGetClientConfig.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Error),
    );

    expect(result.current.config.asrModelId).toBeNull();
    expect(result.current.config.transcribeSizeLimitBytes).toBe(
      5 * 1024 * 1024,
    );
    expect(result.current.config.dialCoreExternalUrl).toBeNull();
    expect(result.current.config.overlayEnabled).toBe(false);
    expect(result.current.config.overlayAllowedOrigins).toEqual([]);
    expect(result.current.config.announcementHtml).toBeNull();
  });

  it('populates announcementHtml from a successful API call', async () => {
    mockGetClientConfig.mockResolvedValue({
      appId: 'chat-ui',
      features: { asrEnabled: false },
      config: {
        asrModelId: null,
        transcribeSizeLimitBytes: 5_242_880,
        dialCoreExternalUrl: null,
        announcementHtml: 'Welcome to <b>DIAL</b>!',
      },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.config.announcementHtml).toBe(
      'Welcome to <b>DIAL</b>!',
    );
  });

  it('keeps announcementHtml null when the backend omits it or the call fails', async () => {
    mockGetClientConfig.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Error),
    );

    expect(result.current.config.announcementHtml).toBeNull();
  });

  it('defaults the announcement title and description to null before config loads', () => {
    mockGetClientConfig.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    expect(result.current.config.announcementTitle).toBeNull();
    expect(result.current.config.announcementDescription).toBeNull();
  });

  it('populates the announcement title and description from a successful API call', async () => {
    mockGetClientConfig.mockResolvedValue({
      appId: 'chat-ui',
      features: {},
      config: {
        announcementTitle: '🎉 Welcome to DIAL! 🎉',
        announcementDescription: 'Explore our AI offerings with your data.',
      },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.config.announcementTitle).toBe(
      '🎉 Welcome to DIAL! 🎉',
    );
    expect(result.current.config.announcementDescription).toBe(
      'Explore our AI offerings with your data.',
    );
  });

  it('keeps the announcement title and description null when the call fails', async () => {
    mockGetClientConfig.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Error),
    );

    expect(result.current.config.announcementTitle).toBeNull();
    expect(result.current.config.announcementDescription).toBeNull();
  });

  it('keeps the announcement description null when the backend sends only a title', async () => {
    mockGetClientConfig.mockResolvedValue({
      appId: 'chat-ui',
      features: {},
      config: { announcementTitle: 'Title only' },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.config.announcementTitle).toBe('Title only');
    expect(result.current.config.announcementDescription).toBeNull();
  });

  it('defaults announcements to an empty array before config loads', () => {
    mockGetClientConfig.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    expect(result.current.config.announcements).toEqual([]);
  });

  it('populates announcements from a successful API call', async () => {
    mockGetClientConfig.mockResolvedValue({
      appId: 'chat-ui',
      features: {},
      config: {
        announcements: [
          {
            title: 'Upgraded to DIAL 1.43',
            description: null,
            link: { label: 'Changelog', href: 'https://dialx.ai' },
          },
        ],
      },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.config.announcements).toHaveLength(1);
    expect(result.current.config.announcements[0].title).toBe(
      'Upgraded to DIAL 1.43',
    );
  });

  it('normalizes a non-array announcements value to an empty array', async () => {
    mockGetClientConfig.mockResolvedValue({
      appId: 'chat-ui',
      features: {},
      config: { announcements: null },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.config.announcements).toEqual([]);
  });

  it('keeps announcements empty when the call fails', async () => {
    mockGetClientConfig.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Error),
    );

    expect(result.current.config.announcements).toEqual([]);
  });

  it('keeps the announcements array reference stable across renders', async () => {
    mockGetClientConfig.mockResolvedValue({
      appId: 'chat-ui',
      features: {},
      config: {
        announcements: [{ title: 'One', description: null, link: null }],
      },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result, rerender } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );
    const first = result.current.config.announcements;
    rerender();

    expect(result.current.config.announcements).toBe(first);
  });

  it('keeps dialCoreExternalUrl null when the backend omits it', async () => {
    mockGetClientConfig.mockResolvedValue({
      appId: 'chat-ui',
      features: { asrEnabled: false },
      config: {
        asrModelId: null,
        transcribeSizeLimitBytes: 5_242_880,
        dialCoreExternalUrl: null,
      },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.config.dialCoreExternalUrl).toBeNull();
    expect(result.current.config.fileManagerTabs).toEqual([
      'all',
      'my_files',
      'shared',
      'organization',
    ]);
  });

  it('populates enabledUiFeatures from a successful API call', async () => {
    mockGetClientConfig.mockResolvedValue({
      appId: 'chat-ui',
      features: { asrEnabled: false },
      config: {
        asrModelId: null,
        transcribeSizeLimitBytes: 5_242_880,
        dialCoreExternalUrl: null,
        enabledUiFeatures: ['header', 'likes', 'hide-new-conversation'],
      },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.config.enabledUiFeatures).toEqual([
      'header',
      'likes',
      'hide-new-conversation',
    ]);
  });

  describe('useFeatureFlag', () => {
    it('returns false while loading', () => {
      mockGetClientConfig.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(
        () => useFeatureFlag('features.asrEnabled'),
        { wrapper },
      );
      expect(result.current).toBe(false);
    });

    it('returns true when feature is enabled and ready', async () => {
      mockGetClientConfig.mockResolvedValue(READY_RESPONSE);
      const { result } = renderHook(() => useFeatureFlag('asrEnabled'), {
        wrapper,
      });

      await waitFor(() => expect(result.current).toBe(true));
    });

    it('returns false for unknown feature key even when ready', async () => {
      mockGetClientConfig.mockResolvedValue(READY_RESPONSE);
      const { result } = renderHook(() => useFeatureFlag('unknownFeature'), {
        wrapper,
      });

      await waitFor(() =>
        expect(vi.mocked(appConfigApi.getClientConfig)).toHaveBeenCalledOnce(),
      );
      expect(result.current).toBe(false);
    });
  });

  describe('useAppConfig outside provider', () => {
    it('throws when used outside AppConfigProvider', () => {
      expect(() => renderHook(() => useAppConfig())).toThrow(
        'useAppConfig must be used within AppConfigProvider',
      );
    });
  });

  describe('cancellation on unmount', () => {
    it('aborts the request and does not update state after unmount', async () => {
      let resolvePromise!: (value: typeof READY_RESPONSE) => void;
      const promise = new Promise<typeof READY_RESPONSE>((res) => {
        resolvePromise = res;
      });
      mockGetClientConfig.mockReturnValue(promise);

      const { result, unmount } = renderHook(() => useAppConfig(), { wrapper });
      expect(result.current.status).toBe(UserConfigStatus.Loading);
      const signal = mockGetClientConfig.mock.calls[0]?.[0];
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal?.aborted).toBe(false);

      unmount();
      expect(signal?.aborted).toBe(true);

      // Resolve after unmount — should not cause a state update
      await act(async () => {
        resolvePromise(READY_RESPONSE);
        await promise;
      });

      // Status should still be loading because the provider was unmounted.
      expect(result.current.status).toBe(UserConfigStatus.Loading);
    });
  });

  describe('customVisualizers', () => {
    it('defaults to [] before the config loads', () => {
      mockGetClientConfig.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAppConfig(), { wrapper });
      expect(result.current.config.customVisualizers).toEqual([]);
    });

    it('surfaces customVisualizers from the API response', async () => {
      const entry = {
        contentType: 'application/x-test',
        url: 'https://viz.example.com',
        title: 'my-viz',
      };
      mockGetClientConfig.mockResolvedValue({
        ...READY_RESPONSE,
        config: {
          ...(READY_RESPONSE as unknown as { config: object }).config,
          customVisualizers: [entry],
        },
      } as unknown as ClientConfigResponseDto);

      const { result } = renderHook(() => useAppConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.config.customVisualizers).toEqual([entry]);
    });

    it('defaults to [] when customVisualizers is absent from the response', async () => {
      mockGetClientConfig.mockResolvedValue(READY_RESPONSE);
      const { result } = renderHook(() => useAppConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.config.customVisualizers).toEqual([]);
    });
  });

  describe('publicationFilterSources', () => {
    it('defaults to the legacy-matching list before the config loads', () => {
      mockGetClientConfig.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAppConfig(), { wrapper });
      expect(result.current.config.publicationFilterSources).toEqual([
        'title',
        'role',
        'dial_roles',
      ]);
    });

    it('surfaces an operator-configured list from a successful API call', async () => {
      mockGetClientConfig.mockResolvedValue({
        ...READY_RESPONSE,
        config: {
          ...(READY_RESPONSE as unknown as { config: object }).config,
          publicationFilterSources: ['roles', 'department'],
        },
      } as unknown as ClientConfigResponseDto);

      const { result } = renderHook(() => useAppConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.config.publicationFilterSources).toEqual([
        'roles',
        'department',
      ]);
    });

    it('remains at the default when the API call fails', async () => {
      mockGetClientConfig.mockRejectedValue(new Error('network error'));
      const { result } = renderHook(() => useAppConfig(), { wrapper });

      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Error),
      );

      expect(result.current.config.publicationFilterSources).toEqual([
        'title',
        'role',
        'dial_roles',
      ]);
    });
  });

  describe('maxAttachmentFileSizeBytes', () => {
    it('defaults to 512 MB before the config loads', () => {
      mockGetClientConfig.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAppConfig(), { wrapper });
      expect(result.current.config.maxAttachmentFileSizeBytes).toBe(
        536_870_912,
      );
    });

    it('surfaces an operator-configured value from a successful API call', async () => {
      mockGetClientConfig.mockResolvedValue({
        ...READY_RESPONSE,
        config: {
          ...(READY_RESPONSE as unknown as { config: object }).config,
          maxAttachmentFileSizeBytes: 104_857_600,
        },
      } as unknown as ClientConfigResponseDto);

      const { result } = renderHook(() => useAppConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.config.maxAttachmentFileSizeBytes).toBe(
        104_857_600,
      );
    });

    it('remains at the default when the API call fails', async () => {
      mockGetClientConfig.mockRejectedValue(new Error('network error'));
      const { result } = renderHook(() => useAppConfig(), { wrapper });

      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Error),
      );

      expect(result.current.config.maxAttachmentFileSizeBytes).toBe(
        536_870_912,
      );
    });
  });

  describe('usageLimitsWarningThresholdPercent', () => {
    it('defaults to 75 before the config loads', () => {
      mockGetClientConfig.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAppConfig(), { wrapper });
      expect(result.current.config.usageLimitsWarningThresholdPercent).toBe(75);
    });

    it('surfaces an operator-configured value from a successful API call', async () => {
      mockGetClientConfig.mockResolvedValue({
        ...READY_RESPONSE,
        config: {
          ...(READY_RESPONSE as unknown as { config: object }).config,
          usageLimitsWarningThresholdPercent: 90,
        },
      } as unknown as ClientConfigResponseDto);

      const { result } = renderHook(() => useAppConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.config.usageLimitsWarningThresholdPercent).toBe(90);
    });

    it('falls back to 75 when the response omits the field', async () => {
      const { usageLimitsWarningThresholdPercent: _omitted, ...config } = {
        ...(READY_RESPONSE as unknown as { config: Record<string, unknown> })
          .config,
        usageLimitsWarningThresholdPercent: undefined,
      };
      mockGetClientConfig.mockResolvedValue({
        ...READY_RESPONSE,
        config,
      } as unknown as ClientConfigResponseDto);

      const { result } = renderHook(() => useAppConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.config.usageLimitsWarningThresholdPercent).toBe(75);
    });
  });

  describe('catalog creation permissions', () => {
    const ALL_TYPES = [
      CatalogCreationType.CustomApp,
      CatalogCreationType.SchemaApp,
      CatalogCreationType.Toolset,
      CatalogCreationType.Prompt,
      CatalogCreationType.Skill,
    ];

    const withPermissions = (catalogCreationPermissions: unknown) =>
      ({
        ...READY_RESPONSE,
        config: { ...READY_RESPONSE.config, catalogCreationPermissions },
      }) as unknown as ClientConfigResponseDto;

    const deferred = () => {
      let resolve!: (value: ClientConfigResponseDto) => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<ClientConfigResponseDto>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };

    const sessionUser = (sub: string, providerId = 'keycloak') => ({
      sub,
      providerId,
      claims: {},
    });

    it('starts with unknown permissions', () => {
      mockGetClientConfig.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAppConfig(), { wrapper });

      expect(result.current.catalogCreationStatus).toBe(
        UserConfigStatus.Loading,
      );
      expect(result.current.catalogCreationPermissions).toBeNull();
    });

    it('accepts the permissions of a successful response', async () => {
      const permissions = {
        allowedTypes: [CatalogCreationType.Prompt],
        restrictedSchemaIds: ['schema-A'],
      };
      mockGetClientConfig.mockResolvedValue(withPermissions(permissions));
      const { result } = renderHook(() => useAppConfig(), { wrapper });

      await waitFor(() =>
        expect(result.current.catalogCreationStatus).toBe(
          UserConfigStatus.Ready,
        ),
      );
      expect(result.current.catalogCreationPermissions).toEqual(permissions);
    });

    it('allows every type when an older backend omits the field', async () => {
      mockGetClientConfig.mockResolvedValue(READY_RESPONSE);
      const { result } = renderHook(() => useAppConfig(), { wrapper });

      await waitFor(() =>
        expect(result.current.catalogCreationStatus).toBe(
          UserConfigStatus.Ready,
        ),
      );
      expect(result.current.catalogCreationPermissions).toEqual({
        allowedTypes: ALL_TYPES,
        restrictedSchemaIds: [],
      });
    });

    it.each([
      ['null', null],
      ['an array', []],
      ['a missing restrictedSchemaIds', { allowedTypes: [] }],
      ['a non-string type', { allowedTypes: [7], restrictedSchemaIds: [] }],
      [
        'a string type list',
        { allowedTypes: 'skill', restrictedSchemaIds: [] },
      ],
    ])(
      'marks creation unavailable for %s without discarding other config',
      async (_label, malformed) => {
        mockGetClientConfig.mockResolvedValue(withPermissions(malformed));
        const { result } = renderHook(() => useAppConfig(), { wrapper });

        await waitFor(() =>
          expect(result.current.catalogCreationStatus).toBe(
            UserConfigStatus.Error,
          ),
        );
        expect(result.current.catalogCreationPermissions).toBeNull();
        expect(result.current.status).toBe(UserConfigStatus.Ready);
        expect(result.current.config.asrModelId).toBe('whisper-1');
      },
    );

    it('ignores type values the client does not know', async () => {
      mockGetClientConfig.mockResolvedValue(
        withPermissions({
          allowedTypes: ['prompt', 'future-type'],
          restrictedSchemaIds: [],
        }),
      );
      const { result } = renderHook(() => useAppConfig(), { wrapper });

      await waitFor(() =>
        expect(result.current.catalogCreationStatus).toBe(
          UserConfigStatus.Ready,
        ),
      );
      expect(result.current.catalogCreationPermissions?.allowedTypes).toEqual([
        CatalogCreationType.Prompt,
      ]);
    });

    it('marks creation unavailable when the request fails', async () => {
      mockGetClientConfig.mockRejectedValue(new Error('network error'));
      const { result } = renderHook(() => useAppConfig(), { wrapper });

      await waitFor(() =>
        expect(result.current.catalogCreationStatus).toBe(
          UserConfigStatus.Error,
        ),
      );
      expect(result.current.catalogCreationPermissions).toBeNull();
    });

    it('withholds the previous user permissions immediately after an identity switch', async () => {
      mockSession.current = {
        user: sessionUser('user-1'),
        status: AuthStatus.Authenticated,
      };
      mockGetClientConfig.mockResolvedValueOnce(
        withPermissions({ allowedTypes: ALL_TYPES, restrictedSchemaIds: [] }),
      );
      const second = deferred();
      mockGetClientConfig.mockReturnValueOnce(second.promise);
      const { result, rerender } = renderHook(() => useAppConfig(), {
        wrapper,
      });
      await waitFor(() =>
        expect(result.current.catalogCreationStatus).toBe(
          UserConfigStatus.Ready,
        ),
      );

      /* Same auth status, another authenticated user. */
      mockSession.current = {
        user: sessionUser('user-2'),
        status: AuthStatus.Authenticated,
      };
      rerender();

      expect(result.current.catalogCreationStatus).toBe(
        UserConfigStatus.Loading,
      );
      expect(result.current.catalogCreationPermissions).toBeNull();
      expect(result.current.status).toBe(UserConfigStatus.Ready);
      expect(mockGetClientConfig).toHaveBeenCalledTimes(2);

      await act(async () => {
        second.resolve(
          withPermissions({
            allowedTypes: [CatalogCreationType.Prompt],
            restrictedSchemaIds: [],
          }),
        );
        await second.promise;
      });

      expect(result.current.catalogCreationStatus).toBe(UserConfigStatus.Ready);
      expect(result.current.catalogCreationPermissions?.allowedTypes).toEqual([
        CatalogCreationType.Prompt,
      ]);
    });

    it('treats the same subject from another provider as a new identity', async () => {
      mockSession.current = {
        user: sessionUser('user-1', 'keycloak'),
        status: AuthStatus.Authenticated,
      };
      mockGetClientConfig.mockResolvedValueOnce(READY_RESPONSE);
      mockGetClientConfig.mockReturnValueOnce(new Promise(() => undefined));
      const { result, rerender } = renderHook(() => useAppConfig(), {
        wrapper,
      });
      await waitFor(() =>
        expect(result.current.catalogCreationStatus).toBe(
          UserConfigStatus.Ready,
        ),
      );

      mockSession.current = {
        user: sessionUser('user-1', 'azure'),
        status: AuthStatus.Authenticated,
      };
      rerender();

      expect(result.current.catalogCreationPermissions).toBeNull();
      expect(mockGetClientConfig).toHaveBeenCalledTimes(2);
    });

    it('does not let an obsolete response restore the previous permissions', async () => {
      mockSession.current = {
        user: sessionUser('user-1'),
        status: AuthStatus.Authenticated,
      };
      const first = deferred();
      mockGetClientConfig.mockReturnValueOnce(first.promise);
      mockGetClientConfig.mockReturnValueOnce(new Promise(() => undefined));
      const { result, rerender } = renderHook(() => useAppConfig(), {
        wrapper,
      });

      mockSession.current = {
        user: sessionUser('user-2'),
        status: AuthStatus.Authenticated,
      };
      rerender();
      await act(async () => {
        first.resolve(
          withPermissions({ allowedTypes: ALL_TYPES, restrictedSchemaIds: [] }),
        );
        await first.promise;
      });

      expect(result.current.catalogCreationStatus).toBe(
        UserConfigStatus.Loading,
      );
      expect(result.current.catalogCreationPermissions).toBeNull();
    });

    it('withholds permissions while authentication is resolving', async () => {
      mockGetClientConfig.mockResolvedValue(READY_RESPONSE);
      const { result, rerender } = renderHook(() => useAppConfig(), {
        wrapper,
      });
      await waitFor(() =>
        expect(result.current.catalogCreationStatus).toBe(
          UserConfigStatus.Ready,
        ),
      );

      mockSession.current = { user: null, status: AuthStatus.Loading };
      rerender();

      expect(result.current.catalogCreationStatus).toBe(
        UserConfigStatus.Loading,
      );
      expect(result.current.catalogCreationPermissions).toBeNull();
    });

    it('does not keep stale permissions after a failed refetch', async () => {
      mockSession.current = { user: null, status: AuthStatus.Unauthenticated };
      mockGetClientConfig.mockResolvedValueOnce(READY_RESPONSE);
      mockGetClientConfig.mockRejectedValueOnce(new Error('network error'));
      const { result, rerender } = renderHook(() => useAppConfig(), {
        wrapper,
      });
      await waitFor(() =>
        expect(result.current.catalogCreationStatus).toBe(
          UserConfigStatus.Ready,
        ),
      );

      mockSession.current = {
        user: sessionUser('user-1'),
        status: AuthStatus.Authenticated,
      };
      rerender();

      await waitFor(() =>
        expect(result.current.catalogCreationStatus).toBe(
          UserConfigStatus.Error,
        ),
      );
      expect(result.current.catalogCreationPermissions).toBeNull();
    });

    it('keeps unrelated config ready while permissions reload', async () => {
      mockGetClientConfig.mockResolvedValueOnce(READY_RESPONSE);
      mockGetClientConfig.mockReturnValueOnce(new Promise(() => undefined));
      const { result, rerender } = renderHook(() => useAppConfig(), {
        wrapper,
      });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );

      mockSession.current = {
        user: sessionUser('user-1'),
        status: AuthStatus.Authenticated,
      };
      rerender();

      expect(result.current.status).toBe(UserConfigStatus.Ready);
      expect(result.current.features['asrEnabled']).toBe(true);
      expect(result.current.catalogCreationStatus).toBe(
        UserConfigStatus.Loading,
      );
    });
  });
});

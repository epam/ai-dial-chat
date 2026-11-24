import {
  AnnouncementSeverity as AnnouncementSeverityDto,
  CatalogCreationType,
  type ClientConfigResponseDto,
} from '@epam/ai-dial-chat-api-client';
import {
  AnnouncementSeverity,
  SpendingLimitsMode,
} from '@epam/ai-dial-chat-hooks';
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
  appId: 'ai-dial-chat',
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
      appId: 'ai-dial-chat',
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
      appId: 'ai-dial-chat',
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
      appId: 'ai-dial-chat',
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
      appId: 'ai-dial-chat',
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
      appId: 'ai-dial-chat',
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
      appId: 'ai-dial-chat',
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

  it('maps each announcement severity onto the lib enum and keeps the other fields', async () => {
    const link = { label: 'Details', href: 'https://dialx.ai' };
    mockGetClientConfig.mockResolvedValue({
      appId: 'ai-dial-chat',
      features: {},
      config: {
        announcements: [
          {
            title: 'Upcoming maintenance',
            description: 'Saturday 10:00 UTC',
            link,
            severity: AnnouncementSeverityDto.Warning,
          },
        ],
      },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.config.announcements).toEqual([
      {
        title: 'Upcoming maintenance',
        description: 'Saturday 10:00 UTC',
        link,
        severity: AnnouncementSeverity.Warning,
      },
    ]);
  });

  it('reports info for an announcement the backend sends without a severity', async () => {
    mockGetClientConfig.mockResolvedValue({
      appId: 'ai-dial-chat',
      features: {},
      config: {
        announcements: [{ title: 'News', description: null, link: null }],
      },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.config.announcements[0].severity).toBe(
      AnnouncementSeverity.Info,
    );
  });

  it('normalizes a non-array announcements value to an empty array', async () => {
    mockGetClientConfig.mockResolvedValue({
      appId: 'ai-dial-chat',
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
      appId: 'ai-dial-chat',
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
      appId: 'ai-dial-chat',
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
      appId: 'ai-dial-chat',
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

  it('exposes no publication filter sources, since publish access rules are gone', async () => {
    mockGetClientConfig.mockResolvedValue(READY_RESPONSE);
    const { result } = renderHook(() => useAppConfig(), { wrapper });
    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );
    expect(result.current.config).not.toHaveProperty(
      'publicationFilterSources',
    );
  });

  describe('additionalContentLocales', () => {
    it('surfaces the configured codes from a successful API call', async () => {
      mockGetClientConfig.mockResolvedValue({
        ...READY_RESPONSE,
        config: {
          ...(READY_RESPONSE as unknown as { config: object }).config,
          additionalContentLocales: ['de', 'fr-FR'],
        },
      } as unknown as ClientConfigResponseDto);

      const { result } = renderHook(() => useAppConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.config.additionalContentLocales).toEqual([
        'de',
        'fr-FR',
      ]);
    });

    it('defaults to an empty list when the field is missing', async () => {
      const config: Record<string, unknown> = {
        ...(READY_RESPONSE as unknown as { config: object }).config,
      };
      delete config.additionalContentLocales;
      mockGetClientConfig.mockResolvedValue({
        ...READY_RESPONSE,
        config,
      } as unknown as ClientConfigResponseDto);

      const { result } = renderHook(() => useAppConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.config.additionalContentLocales).toEqual([]);
    });

    it('remains an empty list when the API call fails', async () => {
      mockGetClientConfig.mockRejectedValue(new Error('network error'));
      const { result } = renderHook(() => useAppConfig(), { wrapper });

      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Error),
      );
      expect(result.current.config.additionalContentLocales).toEqual([]);
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

  describe('project context limits', () => {
    const withConfig = (config: Record<string, unknown>) =>
      ({
        ...READY_RESPONSE,
        config: {
          ...(READY_RESPONSE as unknown as { config: object }).config,
          ...config,
        },
      }) as unknown as ClientConfigResponseDto;

    it('defaults to 1 MiB, 10 MiB and csv, pdf, xlsx before the config loads', () => {
      mockGetClientConfig.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAppConfig(), { wrapper });

      expect(result.current.config.projectContextFileMaxBytes).toBe(1_048_576);
      expect(result.current.config.projectContextTotalMaxBytes).toBe(
        10_485_760,
      );
      expect(result.current.config.projectContextAllowedExtensions).toEqual([
        'csv',
        'pdf',
        'xlsx',
      ]);
    });

    it('surfaces operator-configured values from a successful API call', async () => {
      mockGetClientConfig.mockResolvedValue(
        withConfig({
          projectContextFileMaxBytes: 2_097_152,
          projectContextTotalMaxBytes: 4_194_304,
          projectContextAllowedExtensions: ['CSV', 'md'],
        }),
      );

      const { result } = renderHook(() => useAppConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );

      expect(result.current.config.projectContextFileMaxBytes).toBe(2_097_152);
      expect(result.current.config.projectContextTotalMaxBytes).toBe(4_194_304);
      expect(result.current.config.projectContextAllowedExtensions).toEqual([
        'csv',
        'md',
      ]);
    });

    it('falls back to the defaults for an older BFF or invalid values', async () => {
      mockGetClientConfig.mockResolvedValue(
        withConfig({
          projectContextTotalMaxBytes: 0,
          projectContextAllowedExtensions: [],
        }),
      );

      const { result } = renderHook(() => useAppConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );

      expect(result.current.config.projectContextFileMaxBytes).toBe(1_048_576);
      expect(result.current.config.projectContextTotalMaxBytes).toBe(
        10_485_760,
      );
      expect(result.current.config.projectContextAllowedExtensions).toEqual([
        'csv',
        'pdf',
        'xlsx',
      ]);
    });

    it('keeps the last loaded values when a refetch fails', async () => {
      mockSession.current = { user: null, status: AuthStatus.Unauthenticated };
      mockGetClientConfig.mockResolvedValueOnce(
        withConfig({ projectContextFileMaxBytes: 2_097_152 }),
      );
      mockGetClientConfig.mockRejectedValueOnce(new Error('network error'));
      const { result, rerender } = renderHook(() => useAppConfig(), {
        wrapper,
      });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );

      mockSession.current = {
        user: { sub: 'user-1', providerId: 'keycloak', claims: {} },
        status: AuthStatus.Authenticated,
      } as typeof mockSession.current;
      rerender();

      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Error),
      );
      expect(result.current.config.projectContextFileMaxBytes).toBe(2_097_152);
    });

    it('keeps the defaults when the first load fails', async () => {
      mockGetClientConfig.mockRejectedValue(new Error('network error'));
      const { result } = renderHook(() => useAppConfig(), { wrapper });

      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Error),
      );

      expect(result.current.config.projectContextFileMaxBytes).toBe(1_048_576);
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

  describe('spendingLimitsMode', () => {
    const loadConfigWithMode = async (spendingLimitsMode: unknown) => {
      mockGetClientConfig.mockResolvedValue({
        ...READY_RESPONSE,
        config: {
          ...(READY_RESPONSE as unknown as { config: object }).config,
          spendingLimitsMode,
        },
      } as unknown as ClientConfigResponseDto);
      const view = renderHook(() => useAppConfig(), { wrapper });
      await waitFor(() =>
        expect(view.result.current.status).toBe(UserConfigStatus.Ready),
      );
      return view.result;
    };

    it('defaults to off before the config loads', () => {
      mockGetClientConfig.mockReturnValue(new Promise(() => undefined));
      const { result } = renderHook(() => useAppConfig(), { wrapper });
      expect(result.current.config.spendingLimitsMode).toBe(
        SpendingLimitsMode.Off,
      );
    });

    it('surfaces an operator-configured mode', async () => {
      const configResult = await loadConfigWithMode('enforce');
      expect(configResult.current.config.spendingLimitsMode).toBe(
        SpendingLimitsMode.Enforce,
      );
    });

    it.each([undefined, 'ENFORCE', 'unknown'])(
      'falls back to off for %j',
      async (value) => {
        const configResult = await loadConfigWithMode(value);
        expect(configResult.current.config.spendingLimitsMode).toBe(
          SpendingLimitsMode.Off,
        );
      },
    );
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

describe('AppConfigContext background refresh', () => {
  const START = Date.UTC(2026, 10, 20, 10);
  let now = START;

  const PERMISSIONS = {
    allowedTypes: [CatalogCreationType.Prompt],
    restrictedSchemaIds: [],
  };

  /* A managed deployment's response: it carries a refresh hint. */
  const managedResponse = (
    welcome: string,
    features: Record<string, boolean> = { usageLimitsControl: true },
  ) =>
    ({
      appId: 'ai-dial-chat',
      features,
      config: {
        welcomeScreenDescription: welcome,
        fileManagerTabs: ['my_files', 'shared'],
        catalogCreationPermissions: PERMISSIONS,
      },
      metadata: {
        resolvedAt: new Date(now).toISOString(),
        cacheTtlSeconds: 60,
        nextRefreshAt: new Date(now + 120_000).toISOString(),
      },
    }) as unknown as ClientConfigResponseDto;

  const deferred = () => {
    let resolve!: (value: ClientConfigResponseDto) => void;
    const promise = new Promise<ClientConfigResponseDto>((settle) => {
      resolve = settle;
    });
    return { promise, resolve };
  };

  /* Moves the clock past the 15-second coalescing gap and focuses the tab. */
  const focusLater = () => {
    now += 20_000;
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    now = START;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    mockSession.current = {
      user: { sub: 'user-a', providerId: 'keycloak', claims: {} },
      status: AuthStatus.Authenticated,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderReady = async () => {
    const statuses: UserConfigStatus[] = [];
    const catalogStatuses: UserConfigStatus[] = [];
    const view = renderHook(
      () => {
        const config = useAppConfig();
        statuses.push(config.status);
        catalogStatuses.push(config.catalogCreationStatus);
        return { config, usageLimits: useFeatureFlag('usageLimitsControl') };
      },
      { wrapper },
    );
    await waitFor(() =>
      expect(view.result.current.config.status).toBe(UserConfigStatus.Ready),
    );
    statuses.length = 0;
    catalogStatuses.length = 0;
    return { ...view, statuses, catalogStatuses };
  };

  it('does not refresh on focus when the response has no hint', async () => {
    mockGetClientConfig.mockResolvedValue(READY_RESPONSE);
    await renderReady();
    focusLater();
    expect(mockGetClientConfig).toHaveBeenCalledTimes(1);
  });

  it('refreshes in the background without leaving the ready state', async () => {
    mockGetClientConfig.mockResolvedValueOnce(managedResponse('First'));
    const { result, statuses, catalogStatuses } = await renderReady();
    mockGetClientConfig.mockResolvedValueOnce(managedResponse('Second'));

    focusLater();

    await waitFor(() =>
      expect(result.current.config.config.welcomeScreenDescription).toBe(
        'Second',
      ),
    );
    expect(mockGetClientConfig).toHaveBeenCalledTimes(2);
    expect(statuses).not.toContain(UserConfigStatus.Loading);
    expect(catalogStatuses).not.toContain(UserConfigStatus.Loading);
    expect(result.current.config.catalogCreationStatus).toBe(
      UserConfigStatus.Ready,
    );
  });

  it('keeps the last values and features after a failed refresh', async () => {
    mockGetClientConfig.mockResolvedValueOnce(managedResponse('First'));
    const { result } = await renderReady();
    mockGetClientConfig.mockRejectedValueOnce(new Error('network error'));

    focusLater();

    await waitFor(() => expect(mockGetClientConfig).toHaveBeenCalledTimes(2));
    await act(async () => undefined);
    expect(result.current.config.status).toBe(UserConfigStatus.Ready);
    expect(result.current.usageLimits).toBe(true);
    expect(result.current.config.config.welcomeScreenDescription).toBe('First');
  });

  it('keeps only the latest of out-of-order results', async () => {
    mockGetClientConfig.mockResolvedValueOnce(managedResponse('Initial'));
    const { result } = await renderReady();
    const first = deferred();
    const second = deferred();
    mockGetClientConfig.mockReturnValueOnce(first.promise);
    mockGetClientConfig.mockReturnValueOnce(second.promise);

    focusLater();
    focusLater();
    await act(async () => {
      second.resolve(managedResponse('Second'));
    });
    await act(async () => {
      first.resolve(managedResponse('First'));
    });

    expect(result.current.config.config.welcomeScreenDescription).toBe(
      'Second',
    );
    const firstSignal = mockGetClientConfig.mock.calls[1][0];
    expect(firstSignal?.aborted).toBe(true);
  });

  it('discards a refresh started for the previous identity', async () => {
    mockGetClientConfig.mockResolvedValueOnce(managedResponse('For A'));
    const { result, rerender } = await renderReady();
    const forA = deferred();
    mockGetClientConfig.mockReturnValueOnce(forA.promise);
    focusLater();
    const signalA = mockGetClientConfig.mock.calls[1][0];

    mockGetClientConfig.mockResolvedValueOnce(managedResponse('For B'));
    mockSession.current = {
      user: { sub: 'user-b', providerId: 'keycloak', claims: {} },
      status: AuthStatus.Authenticated,
    };
    rerender();
    await waitFor(() =>
      expect(result.current.config.config.welcomeScreenDescription).toBe(
        'For B',
      ),
    );
    expect(signalA?.aborted).toBe(true);

    await act(async () => {
      forA.resolve(managedResponse('Late for A'));
    });
    expect(result.current.config.config.welcomeScreenDescription).toBe('For B');
  });

  it('does not let a background refresh supersede a slow identity reload', async () => {
    mockGetClientConfig.mockResolvedValueOnce(managedResponse('For A'));
    const { result, rerender } = await renderReady();
    const forB = deferred();
    mockGetClientConfig.mockReturnValueOnce(forB.promise);
    mockSession.current = {
      user: { sub: 'user-b', providerId: 'keycloak', claims: {} },
      status: AuthStatus.Authenticated,
    };
    rerender();
    await waitFor(() => expect(mockGetClientConfig).toHaveBeenCalledTimes(2));
    const signalB = mockGetClientConfig.mock.calls[1][0];

    focusLater();
    focusLater();

    expect(mockGetClientConfig).toHaveBeenCalledTimes(2);
    expect(signalB?.aborted).toBe(false);
    await act(async () => {
      forB.resolve(managedResponse('For B'));
    });
    expect(result.current.config.config.welcomeScreenDescription).toBe('For B');
  });

  it('keeps references of values a refresh returned unchanged', async () => {
    mockGetClientConfig.mockResolvedValueOnce(managedResponse('Same'));
    const { result } = await renderReady();
    const tabs = result.current.config.config.fileManagerTabs;
    const features = result.current.config.features;
    mockGetClientConfig.mockResolvedValueOnce(managedResponse('Changed'));

    focusLater();

    await waitFor(() =>
      expect(result.current.config.config.welcomeScreenDescription).toBe(
        'Changed',
      ),
    );
    expect(result.current.config.config.fileManagerTabs).toBe(tabs);
    expect(result.current.config.features).toBe(features);
  });
});

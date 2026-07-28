import type { ClientConfigResponseDto } from '@epam/chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as appConfigApi from '../../server-api/app-config.api';
import { UserConfigStatus } from '../../types/user-config-status';
import AppConfigProvider, {
  useAppConfig,
  useFeatureFlag,
} from '../AppConfigContext';

vi.mock('../../server-api/app-config.api');
vi.mock('../auth/UserContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/UserContext')>();
  return {
    ...actual,
    useUser: () => ({
      user: null,
      status: 'authenticated',
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in loading state', () => {
    mockGetClientConfig.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useAppConfig(), { wrapper });
    expect(result.current.status).toBe(UserConfigStatus.Loading);
    expect(result.current.config.dialCoreExternalUrl).toBeNull();
    expect(result.current.config.fileManagerTabs).toEqual([
      'my_files',
      'shared',
      'organization',
    ]);
    expect(result.current.config.overlayEnabled).toBe(false);
    expect(result.current.config.overlayAllowedOrigins).toEqual([]);
    expect(result.current.config.enabledUiFeatures).toBeNull();
    expect(result.current.config.announcementHtml).toBeNull();
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
      },
      metadata: { resolvedAt: '2026-06-22T00:00:00.000Z', cacheTtlSeconds: 60 },
    } as unknown as ClientConfigResponseDto);
    const { result } = renderHook(() => useAppConfig(), { wrapper });

    await waitFor(() =>
      expect(result.current.status).toBe(UserConfigStatus.Ready),
    );

    expect(result.current.config.overlayEnabled).toBe(true);
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
});

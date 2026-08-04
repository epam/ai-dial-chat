import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserConfigStatus } from '../../types/user-config-status';
import { AppConfigState, useAppConfig } from '../AppConfigContext';
import { UiFeaturesProvider, useUiFeatures } from '../UiFeaturesContext';

vi.mock('../AppConfigContext', () => ({
  useAppConfig: vi.fn(),
}));

const mockUseAppConfig = vi.mocked(useAppConfig);

const mockAppConfig = (enabledUiFeatures: string[] | null = null) =>
  mockUseAppConfig.mockReturnValue({
    status: UserConfigStatus.Ready,
    features: {},
    config: {
      asrModelId: null,
      transcribeSizeLimitBytes: 5 * 1024 * 1024,
      defaultDeploymentId: null,
      dialCoreExternalUrl: null,
      fileManagerTabs: [],
      overlayEnabled: false,
      overlayAllowedOrigins: [],
      announcementHtml: null,
      deepResearchToolId: null,
      enabledUiFeatures,
      footerHtmlMessage: '',
      customVisualizers: [],
      publicationFilterSources: ['title', 'role', 'dial_roles'],
    },
  } satisfies AppConfigState);

const wrapper = ({ children }: { children: ReactNode }) => (
  <UiFeaturesProvider>{children}</UiFeaturesProvider>
);

describe('UiFeaturesContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('default baseline', () => {
    it('enables exactly the 20 default-on features', () => {
      mockAppConfig();
      const { result } = renderHook(() => useUiFeatures(), { wrapper });

      expect(result.current.enabledFeatures.size).toBe(20);
      expect(result.current.isEnabled(OverlayFeature.Header)).toBe(true);
      expect(
        result.current.isEnabled(OverlayFeature.ConversationsSection),
      ).toBe(true);
      expect(result.current.isEnabled(OverlayFeature.Likes)).toBe(true);
      expect(
        result.current.isEnabled(OverlayFeature.ConversationsSharing),
      ).toBe(true);
    });

    it('leaves the 13 default-off (modifier) features disabled', () => {
      mockAppConfig();
      const { result } = renderHook(() => useUiFeatures(), { wrapper });

      expect(result.current.isEnabled(OverlayFeature.HideNewConversation)).toBe(
        false,
      );
      expect(result.current.isEnabled(OverlayFeature.DisabledSend)).toBe(false);
      expect(result.current.isEnabled(OverlayFeature.HideUserMenu)).toBe(false);
    });
  });

  describe('server-provided baseline', () => {
    it('replaces the default baseline when enabledUiFeatures is set', () => {
      mockAppConfig(['header', 'likes']);
      const { result } = renderHook(() => useUiFeatures(), { wrapper });

      expect(result.current.enabledFeatures.size).toBe(2);
      expect(result.current.isEnabled(OverlayFeature.Header)).toBe(true);
      expect(result.current.isEnabled(OverlayFeature.Likes)).toBe(true);
      expect(
        result.current.isEnabled(OverlayFeature.ConversationsSharing),
      ).toBe(false);
    });

    it('can enable a Hide* modifier flag via the provided list', () => {
      mockAppConfig(['header', 'hide-new-conversation']);
      const { result } = renderHook(() => useUiFeatures(), { wrapper });

      expect(result.current.isEnabled(OverlayFeature.HideNewConversation)).toBe(
        true,
      );
    });

    it('uses the compiled-in defaults when enabledUiFeatures is null', () => {
      mockAppConfig(null);
      const { result } = renderHook(() => useUiFeatures(), { wrapper });

      expect(result.current.enabledFeatures.size).toBe(20);
      expect(result.current.isEnabled(OverlayFeature.Header)).toBe(true);
    });
  });

  describe('overlay override', () => {
    it('drops unknown values while applying the recognized subset', () => {
      mockAppConfig(['likes']);
      const { result } = renderHook(() => useUiFeatures(), { wrapper });

      act(() => {
        result.current.applyOverlayOverride(['header', 'not-a-real-feature']);
      });

      expect(result.current.enabledFeatures.size).toBe(1);
      expect(result.current.isEnabled(OverlayFeature.Header)).toBe(true);
      expect(result.current.isEnabled(OverlayFeature.Likes)).toBe(false);
    });
  });

  describe('useUiFeatures outside the provider', () => {
    it('throws a descriptive error', () => {
      expect(() => renderHook(() => useUiFeatures())).toThrow(
        'useUiFeatures must be used within UiFeaturesProvider',
      );
    });
  });

  describe('memoization', () => {
    it('keeps the same value reference across an unrelated re-render', () => {
      mockAppConfig(null);
      const { result, rerender } = renderHook(() => useUiFeatures(), {
        wrapper,
      });
      const firstValue = result.current;

      rerender();

      expect(result.current).toBe(firstValue);
    });
  });
});

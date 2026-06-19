import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as userConfigApi from '../../server-api/user-config.api';
import { UserConfigStatus } from '../../types/user-config-status';
import { UserConfigProvider, useUserConfig } from '../UserConfigContext';

vi.mock('../../server-api/user-config.api');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    DialSpinner: () => <div data-testid="dial-spinner" />,
  };
});

const mockShowNotification = vi.fn();
vi.mock('../NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

const mockGetUserConfig = vi.mocked(userConfigApi.getUserConfig);
const mockPinConversation = vi.mocked(userConfigApi.pinConversation);
const mockUpdateInstalledToolset = vi.mocked(userConfigApi.updateInstalledToolset);
const mockUpdateInstalledDeployment = vi.mocked(userConfigApi.updateInstalledDeployment);

const fullConfig = {
  version: 2,
  conversations: { pinnedIds: ['conv-1'] },
  toolsets: { installed: ['ts-a'] },
  deployments: { installed: ['dep-1'] },
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <UserConfigProvider>{children}</UserConfigProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUserConfig.mockResolvedValue(fullConfig as never);
  mockPinConversation.mockResolvedValue(undefined);
  mockUpdateInstalledToolset.mockResolvedValue(undefined);
  mockUpdateInstalledDeployment.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UserConfigContext', () => {
  describe('initial load', () => {
    it('transitions status from Loading to Ready on successful fetch', async () => {
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
    });

    it('populates all three arrays from a fully populated response', async () => {
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.pinnedConversationIds).toEqual(['conv-1']);
      expect(result.current.installedToolsetIds).toEqual(['ts-a']);
      expect(result.current.installedDeploymentIds).toEqual(['dep-1']);
    });

    it('normalizes empty sections to []', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 2,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [] },
      } as never);
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.pinnedConversationIds).toEqual([]);
      expect(result.current.installedToolsetIds).toEqual([]);
      expect(result.current.installedDeploymentIds).toEqual([]);
    });

    it('normalizes missing toolsets section to []', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 2,
        conversations: { pinnedIds: ['c1'] },
        deployments: { installed: ['d1'] },
      } as never);
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.installedToolsetIds).toEqual([]);
    });

    it('sets status to Error and arrays to [] on fetch failure', async () => {
      mockGetUserConfig.mockRejectedValue(new Error('network'));
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Error),
      );
      expect(result.current.pinnedConversationIds).toEqual([]);
      expect(result.current.installedToolsetIds).toEqual([]);
      expect(result.current.installedDeploymentIds).toEqual([]);
    });

    it('shows error notification on fetch failure', async () => {
      mockGetUserConfig.mockRejectedValue(new Error('network'));
      renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.objectContaining({ variant: NotificationVariant.Error }),
        ),
      );
    });

    it('logs console.error on fetch failure', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      mockGetUserConfig.mockRejectedValue(new Error('network'));
      renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('UserConfigContext'),
          expect.any(Error),
        ),
      );
    });

    it('calls getUserConfig exactly once — no duplicate on re-render', async () => {
      const { rerender } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(mockGetUserConfig).toHaveBeenCalledOnce(),
      );
      rerender();
      expect(mockGetUserConfig).toHaveBeenCalledOnce();
    });
  });

  describe('spinner and children rendering', () => {
    it('renders DialSpinner while loading', () => {
      let resolve: () => void;
      mockGetUserConfig.mockReturnValue(
        new Promise<never>((r) => {
          resolve = () => r(fullConfig as never);
        }),
      );
      render(
        <UserConfigProvider>
          <div data-testid="child" />
        </UserConfigProvider>,
      );
      expect(screen.getByTestId('dial-spinner')).toBeTruthy();
      expect(screen.queryByTestId('child')).toBeNull();
      // cleanup: resolve to avoid act() warning
      act(() => resolve());
    });

    it('renders children and hides spinner after successful load', async () => {
      render(
        <UserConfigProvider>
          <div data-testid="child" />
        </UserConfigProvider>,
      );
      await waitFor(() =>
        expect(screen.getByTestId('child')).toBeTruthy(),
      );
      expect(screen.queryByTestId('dial-spinner')).toBeNull();
    });

    it('renders children after load failure', async () => {
      mockGetUserConfig.mockRejectedValue(new Error('fail'));
      render(
        <UserConfigProvider>
          <div data-testid="child" />
        </UserConfigProvider>,
      );
      await waitFor(() =>
        expect(screen.getByTestId('child')).toBeTruthy(),
      );
    });
  });

  describe('setPinnedConversation', () => {
    it('adds id to pinnedConversationIds on successful pin', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 2,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [] },
      } as never);
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      await act(async () => {
        await result.current.setPinnedConversation('conv-1', true);
      });
      expect(result.current.pinnedConversationIds).toContain('conv-1');
    });

    it('removes id from pinnedConversationIds on successful unpin', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 2,
        conversations: { pinnedIds: ['conv-1'] },
        toolsets: { installed: [] },
        deployments: { installed: [] },
      } as never);
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      await act(async () => {
        await result.current.setPinnedConversation('conv-1', false);
      });
      expect(result.current.pinnedConversationIds).not.toContain('conv-1');
    });

    it('is idempotent for duplicate pin', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 2,
        conversations: { pinnedIds: ['conv-1'] },
        toolsets: { installed: [] },
        deployments: { installed: [] },
      } as never);
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      await act(async () => {
        await result.current.setPinnedConversation('conv-1', true);
      });
      expect(
        result.current.pinnedConversationIds.filter((x) => x === 'conv-1'),
      ).toHaveLength(1);
    });

    it('reverts optimistic update and rethrows on API failure', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 2,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [] },
      } as never);
      mockPinConversation.mockRejectedValue(new Error('pin failed'));
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      await expect(
        act(async () => {
          await result.current.setPinnedConversation('conv-1', true);
        }),
      ).rejects.toThrow('pin failed');
      expect(result.current.pinnedConversationIds).not.toContain('conv-1');
    });
  });

  describe('setInstalledToolset', () => {
    it('adds id to installedToolsetIds on successful install', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 2,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [] },
      } as never);
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      await act(async () => {
        await result.current.setInstalledToolset('ts-a', true);
      });
      expect(result.current.installedToolsetIds).toContain('ts-a');
    });

    it('reverts optimistic update and rethrows on API failure', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 2,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [] },
      } as never);
      mockUpdateInstalledToolset.mockRejectedValue(new Error('toolset failed'));
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      await expect(
        act(async () => {
          await result.current.setInstalledToolset('ts-a', true);
        }),
      ).rejects.toThrow('toolset failed');
      expect(result.current.installedToolsetIds).not.toContain('ts-a');
    });
  });

  describe('setInstalledDeployment', () => {
    it('adds id to installedDeploymentIds on successful install', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 2,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [] },
      } as never);
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      await act(async () => {
        await result.current.setInstalledDeployment('dep-1', true);
      });
      expect(result.current.installedDeploymentIds).toContain('dep-1');
    });

    it('reverts optimistic update and rethrows on API failure', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 2,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [] },
      } as never);
      mockUpdateInstalledDeployment.mockRejectedValue(
        new Error('deployment failed'),
      );
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      await expect(
        act(async () => {
          await result.current.setInstalledDeployment('dep-1', true);
        }),
      ).rejects.toThrow('deployment failed');
      expect(result.current.installedDeploymentIds).not.toContain('dep-1');
    });
  });
});

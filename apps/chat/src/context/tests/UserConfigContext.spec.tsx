import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as userConfigApi from '../../server-api/user-config.api';
import { UserConfigStatus } from '../../types/user-config-status';
import { UserConfigProvider, useUserConfig } from '../UserConfigContext';
import { createNotificationContextValue } from './notification-context-mock';

const contextMocks = vi.hoisted(() => ({
  userSub: 'user-1' as string | undefined,
}));

vi.mock('../../server-api/user-config.api');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../auth/UserContext', () => ({
  useUser: () => ({
    user: contextMocks.userSub ? { sub: contextMocks.userSub } : null,
  }),
}));
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    Spinner: () => <div data-testid="dial-spinner" />,
  };
});

const mockShowNotification = vi.fn();
vi.mock('../NotificationContext', () => ({
  useNotification: () => createNotificationContextValue(mockShowNotification),
}));

const mockGetUserConfig = vi.mocked(userConfigApi.getUserConfig);
const mockPinConversation = vi.mocked(userConfigApi.pinConversation);
const mockPinProject = vi.mocked(userConfigApi.pinProject);
const mockUpdateInstalledToolset = vi.mocked(
  userConfigApi.updateInstalledToolset,
);
const mockUpdateInstalledDeployment = vi.mocked(
  userConfigApi.updateInstalledDeployment,
);
const mockUpdateSelectedDeployment = vi.mocked(
  userConfigApi.updateSelectedDeployment,
);

const fullConfig = {
  version: 7,
  conversations: { pinnedIds: ['conv-1'] },
  projects: { pinnedIds: [] },
  toolsets: { installed: ['ts-a'] },
  deployments: { installed: ['dep-1'] },
  prompts: { installed: ['Work/AI/summarize'] },
  skills: { installed: ['skills/my-bucket/revenue-skill'] },
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <UserConfigProvider>{children}</UserConfigProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  contextMocks.userSub = 'user-1';
  mockGetUserConfig.mockResolvedValue(fullConfig as never);
  mockPinConversation.mockResolvedValue(undefined);
  mockPinProject.mockResolvedValue(undefined);
  mockUpdateInstalledToolset.mockResolvedValue(undefined);
  mockUpdateInstalledDeployment.mockResolvedValue(undefined);
  mockUpdateSelectedDeployment.mockResolvedValue(undefined);
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
      await waitFor(() => expect(mockGetUserConfig).toHaveBeenCalledOnce());
      rerender();
      expect(mockGetUserConfig).toHaveBeenCalledOnce();
    });
  });

  describe('identity-keyed refetch', () => {
    const Consumer = () => {
      const { pinnedConversationIds } = useUserConfig();
      return <div data-testid="child">{pinnedConversationIds.join(',')}</div>;
    };

    it('resets and refetches user config when the authenticated identity changes', async () => {
      const { rerender } = render(
        <UserConfigProvider>
          <Consumer />
        </UserConfigProvider>,
      );

      await waitFor(() =>
        expect(screen.getByTestId('child').textContent).toBe('conv-1'),
      );

      let resolveRefetch: (value: typeof fullConfig) => void;
      const refetchPromise = new Promise<typeof fullConfig>((resolve) => {
        resolveRefetch = resolve;
      });
      mockGetUserConfig.mockReturnValueOnce(refetchPromise);
      contextMocks.userSub = 'user-2';

      rerender(
        <UserConfigProvider>
          <Consumer />
        </UserConfigProvider>,
      );

      // While the identity-triggered refetch is in flight, UserConfigProvider
      // shows its loading spinner (per the existing "loading spinner"
      // requirement) instead of rendering the previous identity's data.
      expect(mockGetUserConfig).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('dial-spinner')).toBeTruthy();
      expect(screen.queryByTestId('child')).toBeNull();

      await act(async () => {
        resolveRefetch({
          version: 7,
          conversations: { pinnedIds: ['conv-2'] },
          projects: { pinnedIds: [] },
          toolsets: { installed: [] },
          deployments: { installed: [] },
          prompts: { installed: [] },
          skills: { installed: [] },
        });
        await refetchPromise;
      });

      await waitFor(() =>
        expect(screen.getByTestId('child').textContent).toBe('conv-2'),
      );
      expect(mockGetUserConfig).toHaveBeenCalledTimes(2);
    });

    it('does not refetch when the identity object changes but sub stays the same', async () => {
      const { rerender } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() => expect(mockGetUserConfig).toHaveBeenCalledOnce());

      // Same sub value, simulating an in-place UserContext profile refresh.
      contextMocks.userSub = 'user-1';
      rerender();

      expect(mockGetUserConfig).toHaveBeenCalledOnce();
    });
  });

  describe('spinner and children rendering', () => {
    it('renders Spinner while loading', () => {
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
      expect(await screen.findByTestId('child')).toBeTruthy();
      expect(screen.queryByTestId('dial-spinner')).toBeNull();
    });

    it('renders children after load failure', async () => {
      mockGetUserConfig.mockRejectedValue(new Error('fail'));
      render(
        <UserConfigProvider>
          <div data-testid="child" />
        </UserConfigProvider>,
      );
      expect(await screen.findByTestId('child')).toBeTruthy();
    });
  });

  describe('project pins', () => {
    const configWithProjects = (pinnedIds: string[]) =>
      ({
        version: 7,
        conversations: { pinnedIds: [] },
        projects: { pinnedIds },
        toolsets: { installed: [] },
        deployments: { installed: [] },
      }) as never;

    const renderReady = async () => {
      const view = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(view.result.current.status).toBe(UserConfigStatus.Ready),
      );
      return view;
    };

    it('loads the pinned project ids', async () => {
      mockGetUserConfig.mockResolvedValue(
        configWithProjects(['projects/b/q4']),
      );

      const { result } = await renderReady();

      expect(result.current.pinnedProjectIds).toEqual(['projects/b/q4']);
    });

    it('defaults to no pinned projects for a config without the section', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 6,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [] },
      } as never);
      const { result } = await renderReady();

      expect(result.current.pinnedProjectIds).toEqual([]);
    });

    it('pins a project through the pins endpoint', async () => {
      mockGetUserConfig.mockResolvedValue(configWithProjects([]));
      const { result } = await renderReady();

      await act(async () => {
        await result.current.setPinnedProject('projects/b/q4', true);
      });

      expect(result.current.pinnedProjectIds).toEqual(['projects/b/q4']);
      expect(mockPinProject).toHaveBeenCalledWith('projects/b/q4', true);
    });

    it('reverts an optimistic pin and rethrows when the request fails', async () => {
      mockGetUserConfig.mockResolvedValue(configWithProjects([]));
      mockPinProject.mockRejectedValue(new Error('offline'));
      const { result } = await renderReady();

      await act(async () => {
        await expect(
          result.current.setPinnedProject('projects/b/q4', true),
        ).rejects.toThrow('offline');
      });

      expect(result.current.pinnedProjectIds).toEqual([]);
    });

    it('swaps a pinned id in place after a rename without a request', async () => {
      mockGetUserConfig.mockResolvedValue(
        configWithProjects(['projects/b/a', 'projects/b/q4']),
      );
      const { result } = await renderReady();

      act(() => {
        result.current.replacePinnedProjectId(
          'projects/b/q4',
          'projects/b/Q4 launch',
        );
      });

      expect(result.current.pinnedProjectIds).toEqual([
        'projects/b/a',
        'projects/b/Q4 launch',
      ]);
      expect(mockPinProject).not.toHaveBeenCalled();
    });

    it('drops a pinned id without a request when the replacement is null', async () => {
      mockGetUserConfig.mockResolvedValue(
        configWithProjects(['projects/b/a', 'projects/b/q4']),
      );
      const { result } = await renderReady();

      act(() => {
        result.current.replacePinnedProjectId('projects/b/q4', null);
      });

      expect(result.current.pinnedProjectIds).toEqual(['projects/b/a']);
      expect(mockPinProject).not.toHaveBeenCalled();
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

  describe('selectedDeploymentId', () => {
    it('populates selectedDeploymentId from deployments.selectedId on load', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 3,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [], selectedId: 'gpt-4o' },
      } as never);
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );
      expect(result.current.selectedDeploymentId).toBe('gpt-4o');
    });

    it('defaults selectedDeploymentId to null when absent', async () => {
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
      expect(result.current.selectedDeploymentId).toBeNull();
    });
  });

  describe('setSelectedDeployment', () => {
    it('updates selectedDeploymentId optimistically and calls the API', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 3,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [], selectedId: null },
      } as never);
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );

      await act(async () => {
        await result.current.setSelectedDeployment('gpt-4o');
      });

      expect(result.current.selectedDeploymentId).toBe('gpt-4o');
      expect(mockUpdateSelectedDeployment).toHaveBeenCalledWith('gpt-4o');
    });

    it('clears selectedDeploymentId when called with null', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 3,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [], selectedId: 'gpt-4o' },
      } as never);
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );

      await act(async () => {
        await result.current.setSelectedDeployment(null);
      });

      expect(result.current.selectedDeploymentId).toBeNull();
      expect(mockUpdateSelectedDeployment).toHaveBeenCalledWith(null);
    });

    it('keeps optimistic selectedDeploymentId when the API call fails', async () => {
      mockGetUserConfig.mockResolvedValue({
        version: 3,
        conversations: { pinnedIds: [] },
        toolsets: { installed: [] },
        deployments: { installed: [], selectedId: null },
      } as never);
      mockUpdateSelectedDeployment.mockRejectedValue(new Error('save failed'));
      const consoleSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const { result } = renderHook(() => useUserConfig(), { wrapper });
      await waitFor(() =>
        expect(result.current.status).toBe(UserConfigStatus.Ready),
      );

      await act(async () => {
        await result.current.setSelectedDeployment('gpt-4o');
      });

      expect(result.current.selectedDeploymentId).toBe('gpt-4o');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('UserConfigContext'),
        expect.any(Error),
      );
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

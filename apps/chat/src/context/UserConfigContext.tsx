import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import { Spinner } from '@epam/ai-dial-ui-kit';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { UserConfigI18nKeys } from '../constants/translation-keys';
import {
  getUserConfig,
  pinConversation as apiPinConversation,
  pinProject as apiPinProject,
  updateInstalledDeployment,
  updateInstalledToolset,
  updateSelectedDeployment as apiUpdateSelectedDeployment,
} from '../server-api/user-config.api';
import { UserConfigStatus } from '../types/user-config-status';
import { useUser } from './auth/UserContext';
import { useNotification } from './NotificationContext';

interface UserConfigContextType {
  pinnedConversationIds: string[];
  pinnedProjectIds: string[];
  installedToolsetIds: string[];
  installedDeploymentIds: string[];
  selectedDeploymentId: string | null;
  status: UserConfigStatus;
  setPinnedConversation: (id: string, isPinned: boolean) => Promise<void>;
  setPinnedProject: (id: string, isPinned: boolean) => Promise<void>;
  /** Mirrors a pin change the BFF already persisted (a rename, or a delete when `newId` is `null`); sends no request. */
  replacePinnedProjectId: (oldId: string, newId: string | null) => void;
  setInstalledToolset: (id: string, isInstalled: boolean) => Promise<void>;
  setInstalledDeployment: (id: string, isInstalled: boolean) => Promise<void>;
  setSelectedDeployment: (id: string | null) => Promise<void>;
}

const UserConfigContext = createContext<UserConfigContextType | undefined>(
  undefined,
);

export const UserConfigProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const { showErrorNotification } = useNotification();
  const { user } = useUser();
  const userSub = user?.sub;

  const [status, setStatus] = useState<UserConfigStatus>(
    UserConfigStatus.Loading,
  );
  const [pinnedConversationIds, setPinnedConversationIds] = useState<string[]>(
    [],
  );
  const [pinnedProjectIds, setPinnedProjectIds] = useState<string[]>([]);
  const [installedToolsetIds, setInstalledToolsetIds] = useState<string[]>([]);
  const [installedDeploymentIds, setInstalledDeploymentIds] = useState<
    string[]
  >([]);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<
    string | null
  >(null);

  /*
   * userSub is included so that if the authenticated identity changes while
   * this provider stays mounted (an in-place identity adoption — see
   * spa-auth-session's identity revalidation requirement), the user config
   * is reset and refetched instead of continuing to serve the previous
   * identity's snapshot.
   */
  useEffect(() => {
    const guard = { isCancelled: false };

    const load = async () => {
      setStatus(UserConfigStatus.Loading);
      setPinnedConversationIds([]);
      setPinnedProjectIds([]);
      setInstalledToolsetIds([]);
      setInstalledDeploymentIds([]);
      setSelectedDeploymentId(null);
      try {
        const config = await getUserConfig();
        if (guard.isCancelled) return;
        setPinnedConversationIds(config.conversations?.pinnedIds ?? []);
        setPinnedProjectIds(config.projects?.pinnedIds ?? []);
        setInstalledToolsetIds(config.toolsets?.installed ?? []);
        setInstalledDeploymentIds(config.deployments?.installed ?? []);
        setSelectedDeploymentId(config.deployments?.selectedId ?? null);
        setStatus(UserConfigStatus.Ready);
      } catch (err) {
        if (guard.isCancelled) return;
        console.error('[UserConfigContext] Failed to load user config', err);
        const { traceId } = await getApiErrorDetails(err);
        showErrorNotification({
          message: t(UserConfigI18nKeys.LoadError),
          requestId: traceId,
        });
        setStatus(UserConfigStatus.Error);
      }
    };

    void load();

    return () => {
      guard.isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSub]);

  const setPinnedConversation = useCallback(
    async (id: string, isPinned: boolean) => {
      const snapshot = pinnedConversationIds;
      setPinnedConversationIds((prev) =>
        isPinned
          ? prev.includes(id)
            ? prev
            : [...prev, id]
          : prev.filter((x) => x !== id),
      );
      try {
        await apiPinConversation(id, isPinned);
      } catch (err) {
        setPinnedConversationIds(snapshot);
        throw err;
      }
    },
    [pinnedConversationIds],
  );

  const setPinnedProject = useCallback(
    async (id: string, isPinned: boolean) => {
      const snapshot = pinnedProjectIds;
      setPinnedProjectIds((prev) => {
        if (!isPinned) return prev.filter((x) => x !== id);
        return prev.includes(id) ? prev : [...prev, id];
      });
      try {
        await apiPinProject(id, isPinned);
      } catch (err) {
        setPinnedProjectIds(snapshot);
        throw err;
      }
    },
    [pinnedProjectIds],
  );

  const replacePinnedProjectId = useCallback(
    (oldId: string, newId: string | null) => {
      setPinnedProjectIds((prev) => {
        if (!prev.includes(oldId)) return prev;
        if (newId == null) return prev.filter((id) => id !== oldId);
        return prev.map((id) => (id === oldId ? newId : id));
      });
    },
    [],
  );

  const setInstalledToolset = useCallback(
    async (id: string, isInstalled: boolean) => {
      const snapshot = installedToolsetIds;
      setInstalledToolsetIds((prev) =>
        isInstalled
          ? prev.includes(id)
            ? prev
            : [...prev, id]
          : prev.filter((x) => x !== id),
      );
      try {
        await updateInstalledToolset(id, isInstalled);
      } catch (err) {
        setInstalledToolsetIds(snapshot);
        throw err;
      }
    },
    [installedToolsetIds],
  );

  const setInstalledDeployment = useCallback(
    async (id: string, isInstalled: boolean) => {
      const snapshot = installedDeploymentIds;
      setInstalledDeploymentIds((prev) =>
        isInstalled
          ? prev.includes(id)
            ? prev
            : [...prev, id]
          : prev.filter((x) => x !== id),
      );
      try {
        await updateInstalledDeployment(id, isInstalled);
      } catch (err) {
        setInstalledDeploymentIds(snapshot);
        throw err;
      }
    },
    [installedDeploymentIds],
  );

  const setSelectedDeployment = useCallback(async (id: string | null) => {
    setSelectedDeploymentId(id);
    try {
      await apiUpdateSelectedDeployment(id);
    } catch (err) {
      console.warn(
        '[UserConfigContext] Failed to persist selected deployment',
        err,
      );
    }
  }, []);

  const value = useMemo(
    () => ({
      pinnedConversationIds,
      pinnedProjectIds,
      installedToolsetIds,
      installedDeploymentIds,
      selectedDeploymentId,
      status,
      setPinnedConversation,
      setPinnedProject,
      replacePinnedProjectId,
      setInstalledToolset,
      setInstalledDeployment,
      setSelectedDeployment,
    }),
    [
      pinnedConversationIds,
      pinnedProjectIds,
      installedToolsetIds,
      installedDeploymentIds,
      selectedDeploymentId,
      status,
      setPinnedConversation,
      setPinnedProject,
      replacePinnedProjectId,
      setInstalledToolset,
      setInstalledDeployment,
      setSelectedDeployment,
    ],
  );

  if (status === UserConfigStatus.Loading) {
    return (
      <div className="flex size-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <UserConfigContext.Provider value={value}>
      {children}
    </UserConfigContext.Provider>
  );
};

export const useUserConfig = (): UserConfigContextType => {
  const context = useContext(UserConfigContext);
  if (!context) {
    throw new Error('useUserConfig must be used inside UserConfigProvider');
  }
  return context;
};

import { Spinner, NotificationVariant } from '@epam/ai-dial-ui-kit';
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
import { getApiErrorDetails } from '../server-api/api-error';
import {
  getUserConfig,
  pinConversation as apiPinConversation,
  updateInstalledDeployment,
  updateInstalledToolset,
  updateSelectedDeployment as apiUpdateSelectedDeployment,
} from '../server-api/user-config.api';
import { UserConfigStatus } from '../types/user-config-status';
import { useUser } from './auth/UserContext';
import { useNotification } from './NotificationContext';

interface UserConfigContextType {
  pinnedConversationIds: string[];
  installedToolsetIds: string[];
  installedDeploymentIds: string[];
  selectedDeploymentId: string | null;
  status: UserConfigStatus;
  setPinnedConversation: (id: string, isPinned: boolean) => Promise<void>;
  setInstalledToolset: (id: string, isInstalled: boolean) => Promise<void>;
  setInstalledDeployment: (id: string, isInstalled: boolean) => Promise<void>;
  setSelectedDeployment: (id: string | null) => Promise<void>;
}

const UserConfigContext = createContext<UserConfigContextType | undefined>(
  undefined,
);

export const UserConfigProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const { user } = useUser();
  const userSub = user?.sub;

  const [status, setStatus] = useState<UserConfigStatus>(
    UserConfigStatus.Loading,
  );
  const [pinnedConversationIds, setPinnedConversationIds] = useState<string[]>(
    [],
  );
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
      setInstalledToolsetIds([]);
      setInstalledDeploymentIds([]);
      setSelectedDeploymentId(null);
      try {
        const config = await getUserConfig();
        if (guard.isCancelled) return;
        setPinnedConversationIds(config.conversations?.pinnedIds ?? []);
        setInstalledToolsetIds(config.toolsets?.installed ?? []);
        setInstalledDeploymentIds(config.deployments?.installed ?? []);
        setSelectedDeploymentId(config.deployments?.selectedId ?? null);
        setStatus(UserConfigStatus.Ready);
      } catch (err) {
        if (guard.isCancelled) return;
        console.error('[UserConfigContext] Failed to load user config', err);
        const { traceId } = await getApiErrorDetails(err);
        showNotification({
          variant: NotificationVariant.Error,
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
      installedToolsetIds,
      installedDeploymentIds,
      selectedDeploymentId,
      status,
      setPinnedConversation,
      setInstalledToolset,
      setInstalledDeployment,
      setSelectedDeployment,
    }),
    [
      pinnedConversationIds,
      installedToolsetIds,
      installedDeploymentIds,
      selectedDeploymentId,
      status,
      setPinnedConversation,
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

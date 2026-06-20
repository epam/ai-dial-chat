import { DialSpinner, NotificationVariant } from '@epam/ai-dial-ui-kit';
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
  updateInstalledDeployment,
  updateInstalledToolset,
} from '../server-api/user-config.api';
import { UserConfigStatus } from '../types/user-config-status';
import { useNotification } from './NotificationContext';

interface UserConfigContextType {
  pinnedConversationIds: string[];
  installedToolsetIds: string[];
  installedDeploymentIds: string[];
  status: UserConfigStatus;
  setPinnedConversation: (id: string, isPinned: boolean) => Promise<void>;
  setInstalledToolset: (id: string, isInstalled: boolean) => Promise<void>;
  setInstalledDeployment: (id: string, isInstalled: boolean) => Promise<void>;
}

const UserConfigContext = createContext<UserConfigContextType | undefined>(
  undefined,
);

export const UserConfigProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();

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

  useEffect(() => {
    const guard = { isCancelled: false };

    const load = async () => {
      try {
        const config = await getUserConfig();
        if (guard.isCancelled) return;
        setPinnedConversationIds(config.conversations?.pinnedIds ?? []);
        setInstalledToolsetIds(config.toolsets?.installed ?? []);
        setInstalledDeploymentIds(config.deployments?.installed ?? []);
        setStatus(UserConfigStatus.Ready);
      } catch (err) {
        if (guard.isCancelled) return;
        console.error('[UserConfigContext] Failed to load user config', err);
        showNotification({
          variant: NotificationVariant.Error,
          message: t(UserConfigI18nKeys.LoadError),
        });
        setStatus(UserConfigStatus.Error);
      }
    };

    void load();

    return () => {
      guard.isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const value = useMemo(
    () => ({
      pinnedConversationIds,
      installedToolsetIds,
      installedDeploymentIds,
      status,
      setPinnedConversation,
      setInstalledToolset,
      setInstalledDeployment,
    }),
    [
      pinnedConversationIds,
      installedToolsetIds,
      installedDeploymentIds,
      status,
      setPinnedConversation,
      setInstalledToolset,
      setInstalledDeployment,
    ],
  );

  if (status === UserConfigStatus.Loading) {
    return (
      <div className="flex size-full items-center justify-center">
        <DialSpinner />
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

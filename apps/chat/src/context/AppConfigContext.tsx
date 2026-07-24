import {
  createContext,
  FC,
  memo,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getClientConfig } from '../server-api/app-config.api';
import { AuthStatus } from '../types/auth-status';
import { UserConfigStatus } from '../types/user-config-status';
import { useUser } from './auth/UserContext';

const DEFAULT_TRANSCRIBE_SIZE_LIMIT = 5 * 1024 * 1024;
const DEFAULT_FILE_MANAGER_TABS = ['my_files', 'shared', 'organization'];

export interface AppConfigState {
  status: UserConfigStatus;
  features: Record<string, boolean>;
  config: {
    asrModelId: string | null;
    transcribeSizeLimitBytes: number;
    defaultDeploymentId: string | null;
    dialCoreExternalUrl: string | null;
    fileManagerTabs: string[];
    overlayEnabled: boolean;
    overlayAllowedOrigins: string[];
    enabledUiFeatures: string[] | null;
  };
  metadata?: { resolvedAt: string; cacheTtlSeconds: number };
}

const INITIAL_STATE: AppConfigState = {
  status: UserConfigStatus.Loading,
  features: {},
  config: {
    asrModelId: null,
    transcribeSizeLimitBytes: DEFAULT_TRANSCRIBE_SIZE_LIMIT,
    defaultDeploymentId: null,
    dialCoreExternalUrl: null,
    fileManagerTabs: DEFAULT_FILE_MANAGER_TABS,
    overlayEnabled: false,
    overlayAllowedOrigins: [],
    enabledUiFeatures: null,
  },
};

const AppConfigContext = createContext<AppConfigState | undefined>(undefined);

interface Props {
  children: ReactNode;
}

const AppConfigProvider: FC<Props> = ({ children }) => {
  const [state, setState] = useState<AppConfigState>(INITIAL_STATE);
  const { status: authStatus } = useUser();

  const loadConfig = useCallback(
    async (signal: AbortSignal, isCancelled: () => boolean) => {
      try {
        const response = await getClientConfig(signal);
        if (isCancelled()) return;
        setState({
          status: UserConfigStatus.Ready,
          features: (response.features ?? {}) as Record<string, boolean>,
          config: {
            asrModelId: response.config?.asrModelId ?? null,
            transcribeSizeLimitBytes:
              response.config?.transcribeSizeLimitBytes ??
              DEFAULT_TRANSCRIBE_SIZE_LIMIT,
            defaultDeploymentId: response.config?.defaultDeploymentId ?? null,
            dialCoreExternalUrl: response.config?.dialCoreExternalUrl ?? null,
            fileManagerTabs:
              response.config?.fileManagerTabs ?? DEFAULT_FILE_MANAGER_TABS,
            overlayEnabled: response.config?.overlayEnabled ?? false,
            overlayAllowedOrigins: response.config?.overlayAllowedOrigins ?? [],
            enabledUiFeatures: response.config?.enabledUiFeatures ?? null,
          },
          metadata: response.metadata,
        });
      } catch {
        if (isCancelled()) return;
        setState((prev) => ({ ...prev, status: UserConfigStatus.Error }));
      }
    },
    [],
  );

  useEffect(() => {
    if (authStatus === AuthStatus.Loading) return;
    const controller = new AbortController();
    let cancelled = false;
    void loadConfig(controller.signal, () => cancelled);
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loadConfig, authStatus]);

  const value = useMemo(() => state, [state]);

  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  );
};

export default memo(AppConfigProvider);

export const useAppConfig = (): AppConfigState => {
  const ctx = useContext(AppConfigContext);
  if (ctx == null) {
    throw new Error('useAppConfig must be used within AppConfigProvider');
  }
  return ctx;
};

export const useFeatureFlag = (key: string): boolean => {
  const { status, features } = useAppConfig();
  if (status !== UserConfigStatus.Ready) return false;
  return features[key] === true;
};

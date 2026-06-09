import {
  createContext,
  FC,
  memo,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { type AppConfig, getAppConfig } from '../server-api/config.api';

const DEFAULT_TRANSCRIBE_SIZE_LIMIT = 5 * 1024 * 1024;

const AppConfigContext = createContext<AppConfig>({
  asrModelId: null,
  transcribeSizeLimitBytes: DEFAULT_TRANSCRIBE_SIZE_LIMIT,
});

interface Props {
  children: ReactNode;
}

const AppConfigProvider: FC<Props> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>({
    asrModelId: null,
    transcribeSizeLimitBytes: DEFAULT_TRANSCRIBE_SIZE_LIMIT,
  });

  useEffect(() => {
    getAppConfig()
      .then(setConfig)
      .catch(() => {
        // Keep defaults on failure; feature degrades gracefully
      });
  }, []);

  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  );
};

export default memo(AppConfigProvider);

export const useAppConfig = (): AppConfig => useContext(AppConfigContext);

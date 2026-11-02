import type { ProviderInfoDto } from '@epam/ai-dial-chat-api-client';
import {
  LiveRegion,
  LiveRegionElement,
  LoginScreen,
} from '@epam/ai-dial-ui-kit';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { AuthI18nKeys } from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuthRedirect } from '../../hooks/auth/useAuthRedirect';
import { getProviders } from '../../server-api/auth.api';
import { toLoginScreenProviders } from '../../utils/auth';
import { getIconPath } from '../../utils/icon-path';

const LoginPage: FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const callbackUrl = useMemo(() => {
    const raw = searchParams.get('callbackUrl');
    if (raw) {
      if (raw.startsWith('//')) return `${window.location.origin}/`;
      try {
        const parsed = new URL(raw);
        if (parsed.origin === window.location.origin) return raw;
      } catch {
        // fall through to default
      }
    }
    return `${window.location.origin}/`;
  }, [searchParams]);
  useUser(); // subscribes to auth state so useAuthRedirect can redirect authenticated users away from /login
  useAuthRedirect();

  const { currentThemeFavicon } = useTheme();
  const [providers, setProviders] = useState<ProviderInfoDto[] | null>(null);
  const [hasError, setHasError] = useState(false);

  const loadProviders = useCallback(
    async (signal: { isCancelled: boolean }) => {
      try {
        const data = await getProviders();
        if (!signal.isCancelled) {
          setProviders(data);
        }
      } catch {
        if (!signal.isCancelled) {
          setHasError(true);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const signal = { isCancelled: false };
    loadProviders(signal);
    return () => {
      signal.isCancelled = true;
    };
  }, [loadProviders]);

  const loginProviders = useMemo(
    () =>
      !hasError && providers
        ? toLoginScreenProviders(providers, callbackUrl)
        : [],
    [callbackUrl, hasError, providers],
  );

  return (
    <LoginScreen
      className="min-h-screen"
      logoSrc={
        currentThemeFavicon ? getIconPath(currentThemeFavicon) : undefined
      }
      title={t(AuthI18nKeys.LoginTitle)}
      description={t(AuthI18nKeys.LoginDescription)}
      providersLabel={t(AuthI18nKeys.LoginProvidersLabel)}
      providers={loginProviders}
    >
      <LiveRegion
        as={LiveRegionElement.P}
        className="dial-body-text text-center text-primary"
      >
        {hasError && t(AuthI18nKeys.ProvidersError)}
        {!hasError && !providers && t(AuthI18nKeys.Loading)}
      </LiveRegion>
    </LoginScreen>
  );
};

export default memo(LoginPage);

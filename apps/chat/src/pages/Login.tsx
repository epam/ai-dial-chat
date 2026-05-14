import { ProviderInfo } from '@epam/chat-shared';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import { ApiEndpoints, get } from '../server-api/base';

const LoginPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const callbackUrl =
    searchParams.get('callbackUrl') ?? `${window.location.origin}/`;
  useUser();
  useAuthRedirect();

  const [providers, setProviders] = useState<ProviderInfo[] | null>(null);
  const [error, setError] = useState(false);

  const loadProviders = useCallback(async (signal: { cancelled: boolean }) => {
    try {
      const data = await get<ProviderInfo[]>(ApiEndpoints.AUTH_PROVIDERS);
      if (!signal.cancelled) setProviders(data);
    } catch (err) {
      if (!signal.cancelled) {
        console.error(err);
        setError(true);
      }
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    loadProviders(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadProviders]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>{t('auth.providersError')}</p>
      </div>
    );
  }

  if (!providers) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>{t('auth.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">{t('auth.loginTitle')}</h1>
      <p className="text-secondary">{t('auth.loginDescription')}</p>
      <div className="flex flex-col gap-2">
        {providers.map((provider) => (
          <a
            key={provider.id}
            href={`/api/v1/auth/login/${encodeURIComponent(provider.id)}?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="border-accent hover:bg-accent-secondary rounded border px-6 py-2 text-center"
          >
            {t('auth.providerButtonLabel', { provider: provider.label })}
          </a>
        ))}
      </div>
    </div>
  );
};

export default LoginPage;

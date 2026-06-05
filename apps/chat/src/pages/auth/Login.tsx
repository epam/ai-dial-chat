import type { ProviderInfoDto } from '@epam/chat-api-client';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../../context/auth/UserContext';
import { useAuthRedirect } from '../../hooks/auth/useAuthRedirect';
import { getProviders } from '../../server-api/auth.api';

// TODO: change styles, add app logo, etc.
const LoginPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const callbackUrl =
    searchParams.get('callbackUrl') ?? `${window.location.origin}/`;
  useUser(); // subscribes to auth state so useAuthRedirect can redirect authenticated users away from /login
  useAuthRedirect();

  const [providers, setProviders] = useState<ProviderInfoDto[] | null>(null);
  const [hasError, setHasError] = useState(false);

  const loadProviders = useCallback(
    async (signal: { isCancelled: boolean }) => {
      try {
        const data = await getProviders();
        if (!signal.isCancelled) setProviders(data);
      } catch (err) {
        if (!signal.isCancelled) {
          console.error(err);
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

  if (hasError) {
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

export default memo(LoginPage);

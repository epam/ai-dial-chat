import type { ProviderInfoDto } from '@epam/chat-api-client';
import { memo, useCallback, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AuthI18nKeys } from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuthRedirect } from '../../hooks/auth/useAuthRedirect';
import { ThemeId } from '../../types/theme-id';
import { getProviders } from '../../server-api/auth.api';
import { getIconPath } from '../../utils/icon-path';

const handleIconError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.dataset.fallback !== 'true') {
    img.dataset.fallback = 'true';
    img.src = '/auth-providers/keycloak.svg';
  } else {
    img.style.display = 'none';
  }
};

const renderProviders = (
  providers: ProviderInfoDto[],
  callbackUrl: string,
  signInLabel: string,
) => (
  <>
    <p className="text-center text-base text-primary">{signInLabel}</p>
    <div className="flex w-full flex-col gap-3">
      {providers.map((provider) => (
        <a
          key={provider.id}
          href={`/api/v1/auth/login/${encodeURIComponent(provider.id)}?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="flex h-10 w-full items-center justify-center gap-2 rounded border border-primary px-3 text-sm font-semibold text-controls-neutral hover:bg-layer-3"
        >
          <img
            src={`/auth-providers/${provider.id}.svg`}
            alt=""
            aria-hidden="true"
            className="size-5 shrink-0"
            onError={handleIconError}
          />
          {provider.label}
        </a>
      ))}
    </div>
  </>
);

const LoginPage: FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const callbackUrl =
    searchParams.get('callbackUrl') ?? `${window.location.origin}/`;
  useUser();
  useAuthRedirect();

  const { currentThemeFavicon, currentTheme } = useTheme();
  const themeSlug = currentTheme === ThemeId.Light ? 'light' : 'dark';
  const [providers, setProviders] = useState<ProviderInfoDto[] | null>(null);
  const [hasError, setHasError] = useState(false);

  const loadProviders = useCallback(
    async (signal: { isCancelled: boolean }) => {
      try {
        const data = await getProviders();
        setProviders([
          { id: 'keycloak', label: 'Keycloak' },
          { id: 'auth0', label: 'Auth0' },
          { id: 'azure-ad-b2c', label: 'Azure AD B2C' },
          { id: 'okta', label: 'Okta' },
          { id: 'google', label: 'Google' },
          { id: 'gitlab', label: 'GitLab' },
          { id: 'dialx-entra', label: 'DIALX Entra' },
          { id: 'ping-id', label: 'Ping Identity' },
          { id: 'cognito', label: 'Amazon Cognito' },
        ]);
        // if (!signal.isCancelled) setProviders(data);
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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-layer-2">
      <picture className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
        <source
          media="(min-width: 1920px)"
          srcSet={`/1920_login_${themeSlug}%20mode.png`}
        />
        <img
          src={`/768_login_${themeSlug}%20mode.png`}
          alt=""
          className="size-full object-cover"
        />
      </picture>

      <div className="relative mx-6 flex flex-col items-center gap-12 overflow-hidden rounded-xl bg-layer-0 bg-opacity-50 p-16">
        {currentThemeFavicon && (
          <span
            style={{
              backgroundImage: `url(${getIconPath(currentThemeFavicon)})`,
            }}
            className="size-8 shrink-0 bg-contain bg-center bg-no-repeat"
            aria-hidden="true"
          />
        )}

        <div className="flex flex-col items-center gap-8">
          <h1 className="text-center text-[28px] font-semibold leading-10 text-primary">
            {t(AuthI18nKeys.LoginTitle)}
          </h1>

          <div className="flex w-full flex-col items-center gap-5 tablet:w-[400px]">
            {hasError && (
              <p className="text-center text-primary">
                {t(AuthI18nKeys.ProvidersError)}
              </p>
            )}
            {!hasError && !providers && (
              <p className="text-center text-primary">
                {t(AuthI18nKeys.Loading)}
              </p>
            )}
            {!hasError &&
              providers &&
              renderProviders(
                providers,
                callbackUrl,
                t(AuthI18nKeys.LoginDescription),
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(LoginPage);

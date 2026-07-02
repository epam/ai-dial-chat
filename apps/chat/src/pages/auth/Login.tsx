import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonVariant,
  DialButton,
} from '@epam/ai-dial-ui-kit';
import type { ProviderInfoDto } from '@epam/chat-api-client';
import { memo, useCallback, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AuthI18nKeys } from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuthRedirect } from '../../hooks/auth/useAuthRedirect';
import { getProviders } from '../../server-api/auth.api';
import { ThemeId } from '../../types/theme-id';
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
      {providers.map((provider) => {
        const href = `/api/v1/auth/login/${encodeURIComponent(provider.id)}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
        return (
          <DialButton
            key={provider.id}
            variant={ButtonVariant.Neutral}
            appearance={ButtonAppearance.Outlined}
            className="w-full"
            iconBefore={
              <img
                src={`/auth-providers/${provider.id}.svg`}
                alt=""
                aria-hidden="true"
                className="size-5 shrink-0"
                onError={handleIconError}
              />
            }
            label={provider.label}
            onClick={() => {
              window.location.href = href;
            }}
          />
        );
      })}
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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-layer-2 mobile:bg-layer-0 mobile:px-6">
      <div
        className="pointer-events-none absolute inset-0 size-full mobile:hidden"
        aria-hidden="true"
      >
        <picture className="block size-full">
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
      </div>

      <div
        className={mergeClasses(
          'relative mx-6 flex flex-col items-center gap-12 overflow-hidden rounded-xl p-16 mobile:mx-0 mobile:mt-10 mobile:w-full mobile:rounded-none mobile:bg-transparent mobile:p-0',
          currentTheme === ThemeId.Light ? 'bg-blackout-light' : 'bg-blackout',
        )}
      >
        {currentThemeFavicon && (
          <span
            style={{
              backgroundImage: `url(${getIconPath(currentThemeFavicon)})`,
            }}
            className="size-8 shrink-0 bg-contain bg-center bg-no-repeat"
            aria-hidden="true"
          />
        )}

        <div className="flex w-full flex-col items-center gap-8 mobile:gap-6">
          <h1 className="text-center text-[28px] font-semibold leading-10 text-primary mobile:text-[22px] mobile:leading-8">
            {t(AuthI18nKeys.LoginTitle)}
          </h1>

          <div className="flex w-full flex-col items-center gap-5 desktop:w-[400px]">
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

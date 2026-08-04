import { NeutralButton } from '@epam/ai-dial-ui-kit';
import type { ProviderInfoDto } from '@epam/chat-api-client';
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
import ProviderIcon from '../../components/ProviderIcon/ProviderIcon';
import { AuthI18nKeys } from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuthRedirect } from '../../hooks/auth/useAuthRedirect';
import { getProviders } from '../../server-api/auth.api';
import { getIconPath } from '../../utils/icon-path';

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
          <a key={provider.id} href={href} className="w-full">
            <NeutralButton
              className="w-full"
              tabIndex={-1}
              iconBefore={<ProviderIcon providerId={provider.id} />}
              label={provider.label}
            />
          </a>
        );
      })}
    </div>
  </>
);

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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-layer-2 mobile:bg-layer-raised mobile:px-6">
      <div
        className="pointer-events-none absolute inset-0 size-full mobile:hidden"
        aria-hidden="true"
      >
        <picture className="block size-full">
          <source media="(min-width: 1920px)" srcSet="/1920_login.png" />
          <img src="/768_login.png" alt="" className="size-full object-cover" />
        </picture>
      </div>

      <div className="relative mx-6 flex flex-col items-center gap-12 overflow-hidden rounded-xl bg-overlay p-16 mobile:mx-0 mobile:mt-10 mobile:w-full mobile:rounded-none mobile:bg-transparent mobile:p-0">
        {currentThemeFavicon && (
          <span
            style={{
              backgroundImage: `url("${getIconPath(currentThemeFavicon)}")`,
            }}
            className="size-8 shrink-0 bg-contain bg-center bg-no-repeat"
            aria-hidden="true"
          />
        )}

        <div className="flex w-full flex-col items-center gap-8 mobile:gap-6">
          <h1 className="dial-display2-text mobile:dial-h1-text text-center text-primary">
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

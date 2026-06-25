import { signIn, useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo } from 'react';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { Provider } from 'next-auth/providers';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { constructPath } from '@/src/utils/app/shared-utils';
import { getThemeIconUrl } from '@/src/utils/app/themes';
import { getQueryParameterCaseInsensitive } from '@/src/utils/app/url/query-params';
import { authOptions } from '@/src/utils/auth/auth-options';
import {
  DEFAULT_PROVIDER,
  authProviders,
} from '@/src/utils/auth/auth-providers';
import {
  isClientSessionValid,
  isServerSessionValid,
} from '@/src/utils/auth/session';

import { Translation } from '@/src/types/translation';

import { SettingsActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { ErrorMessage } from '@/src/components/Common/ErrorMessage';

import { DialNeutralButton } from '@epam/ai-dial-ui-kit';

const cleanProviderId = (id: string) => id.replace(/[1-9]\d*$/, '');

/**
 * The following errors are passed as error query parameters to the default or overridden sign-in page.
 *
 * [Documentation](https://next-auth.js.org/configuration/pages#sign-in-page) */
export type SignInErrorTypes =
  | 'Signin'
  | 'OAuthSignin'
  | 'OAuthCallback'
  | 'OAuthCreateAccount'
  | 'EmailCreateAccount'
  | 'Callback'
  | 'OAuthAccountNotLinked'
  | 'EmailSignin'
  | 'CredentialsSignin'
  | 'SessionRequired'
  | 'default';

const errors: Record<SignInErrorTypes, string> = {
  Signin: 'Try signing in with a different account.',
  OAuthSignin: 'Try signing in with a different account.',
  OAuthCallback: 'Try signing in with a different account.',
  OAuthCreateAccount: 'Try signing in with a different account.',
  EmailCreateAccount: 'Try signing in with a different account.',
  Callback: 'Try signing in with a different account.',
  OAuthAccountNotLinked:
    'To confirm your identity, sign in with the same account you used originally.',
  EmailSignin: 'The e-mail could not be sent.',
  CredentialsSignin:
    'Sign in failed. Check the details you provided are correct.',
  SessionRequired: 'Please sign in to access this page.',
  default: 'Unable to sign in.',
};

interface PageProps {
  providers: Provider[];
  themesHostDefined: boolean;
  provider?: string;
}

export default function Signin({
  provider: defaultAuthProvider,
  providers,
  themesHostDefined,
}: PageProps) {
  const dispatch = useAppDispatch();
  const { status, ...session } = useSession();
  const { t } = useTranslation(Translation.Common);
  const router = useRouter();
  const logoImgSrc = useMemo(() => {
    if (themesHostDefined) {
      return constructPath(
        process.env.APP_BASE_PATH || '',
        getThemeIconUrl('favicon'),
      );
    }
  }, [themesHostDefined]);

  const searchParams = useSearchParams();
  const errorType = getQueryParameterCaseInsensitive(searchParams, 'error');
  const callbackUrl = getQueryParameterCaseInsensitive(
    searchParams,
    'callbackUrl',
  );

  const errorMessage =
    errorType && typeof errorType === 'string'
      ? t(errors[errorType as SignInErrorTypes] ?? errors.default)
      : undefined;

  useEffect(() => {
    if (status === 'loading') return;

    if (
      defaultAuthProvider &&
      (status === 'unauthenticated' ||
        !isClientSessionValid(session) ||
        !session.data)
    ) {
      void signIn(defaultAuthProvider ?? undefined);
    }

    if (
      process.env.IS_IFRAME &&
      status === 'authenticated' &&
      isClientSessionValid(session) &&
      session.data
    ) {
      let safeUrl = '/';

      if (callbackUrl) {
        try {
          const url = new URL(callbackUrl.toString(), window.location.origin);
          if (url.origin === window.location.origin) {
            safeUrl = url.href;
          }
        } catch (e) {
          console.error('Invalid callbackUrl:', e);
        }
      }
      window.location.href = safeUrl;
    }
  }, [callbackUrl, defaultAuthProvider, router.query, session, status]);

  useEffect(() => {
    dispatch(SettingsActions.setThemesHostDefined(themesHostDefined));
    dispatch(SettingsActions.preInitApp());
  }, [dispatch, themesHostDefined]);

  const handleSignIn = useCallback(async (provider: Provider) => {
    'use server';
    await signIn(provider.id);
  }, []);

  if (
    defaultAuthProvider &&
    (status === 'unauthenticated' ||
      !isClientSessionValid(session) ||
      !session.data)
  ) {
    return null;
  }

  if (
    process.env.IS_IFRAME &&
    status === 'authenticated' &&
    isClientSessionValid(session) &&
    session.data
  ) {
    return null;
  }

  return (
    <div className="flex size-full h-screen flex-col items-center overflow-auto bg-auth-layer-0">
      <div className="shrink grow"></div>
      <div className="my-1 h-fit w-[368px] shrink-0 grow-0 rounded bg-auth-layer-1 p-6">
        <div className="mb-6 flex justify-center">
          {!!logoImgSrc && (
            <Image src={logoImgSrc} alt="Brand" width={70} height={70} />
          )}
        </div>
        <ErrorMessage
          text-sm
          error={errorMessage}
          className="my-4 items-center text-sm"
        />
        <div className="my-4 text-center">
          {providers.length
            ? t(CommonI18nKeys.SignInWith)
            : t(CommonI18nKeys.NoProvidersToSignIn)}
        </div>
        {!!providers.length && (
          <div className="flex flex-col gap-4">
            {providers.map((provider: Provider) => (
              <DialNeutralButton
                className="gap-4"
                onClick={() => {
                  void handleSignIn(provider);
                }}
                key={provider.id + provider.name}
                iconBefore={
                  <Image
                    className="h-6"
                    src={`https://authjs.dev/img/providers/${cleanProviderId(provider.id)}.svg`}
                    alt="Provider icon"
                    width={20}
                    height={20}
                  />
                }
                label={provider.name}
                textClassName="font-semibold"
                data-qa={provider.id}
              />
            ))}
          </div>
        )}
      </div>
      <div className="shrink grow"></div>
    </div>
  );
}

const mapProvider = (provider: Provider) =>
  provider
    ? {
        id: provider.options?.id ?? provider.id,
        name: provider.options?.name ?? provider.name,
        type: provider.type,
      }
    : null;

export const getServerSideProps: GetServerSideProps = async ({
  query,
  req,
  res,
}) => {
  const session = await getServerSession(req, res, authOptions);

  res.setHeader('Cache-Control', 'no-store');

  if (
    !process.env.ALLOW_OPEN_SIGNIN_PAGE_IN_IFRAME ||
    process.env.ALLOW_OPEN_SIGNIN_PAGE_IN_IFRAME === 'false'
  ) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  if (isServerSessionValid(session, true)) {
    return {
      redirect: {
        permanent: false,
        destination: query.callbackUrl ? query.callbackUrl.toString() : '/',
      },
    };
  }

  const checkProvider = authProviders?.some(({ id }) => id === query.provider);

  const providerFromQuery = checkProvider ? query.provider : null;
  const themesHostDefined = !!process.env.THEMES_CONFIG_HOST;

  return {
    props: {
      provider: DEFAULT_PROVIDER ?? providerFromQuery,
      providers: authProviders?.map(mapProvider).filter(Boolean) ?? [],
      themesHostDefined,
    },
  };
};

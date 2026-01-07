import { getProviders, signIn, useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo } from 'react';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { Provider } from 'next-auth/providers';
import Image from 'next/image';
import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { constructPath } from '@/src/utils/app/shared-utils';
import { getThemeIconUrl } from '@/src/utils/app/themes';
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

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import { ButtonVariant, DialButton } from '@epam/ai-dial-ui-kit';

const cleanProviderId = (id: string) => id.replace(/[1-9]\d*$/, '');

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
      const { callbackUrl } = router.query;

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
  }, [defaultAuthProvider, router.query, session, status]);

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
        <div className="flex flex-col gap-4">
          {Object.values(providers).map((provider: Provider) => (
            <DialButton
              className="place-content-center gap-4 p-4"
              onClick={() => {
                void handleSignIn(provider);
              }}
              key={provider.id + provider.name}
              variant={ButtonVariant.Secondary}
              iconBefore={
                <Image
                  className="h-6"
                  src={`https://authjs.dev/img/providers/${cleanProviderId(provider.id)}.svg`}
                  alt="Provider icon"
                  width={24}
                  height={24}
                />
              }
              label={`${t('Sign in with')} ${provider.name}`}
              textClassName="text-lg"
              data-qa={provider.id}
            />
          ))}
        </div>
      </div>
      <div className="shrink grow"></div>
    </div>
  );
}

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

  const checkProvider = authProviders.some(({ id }) => id === query.provider);

  const providerFromQuery = checkProvider ? query.provider : null;
  const providers = await getProviders();
  const themesHostDefined = !!process.env.THEMES_CONFIG_HOST;
  return {
    props: {
      provider: DEFAULT_PROVIDER ?? providerFromQuery,
      providers,
      themesHostDefined,
    },
  };
};

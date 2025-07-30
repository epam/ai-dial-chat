import { getProviders, signIn, useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo } from 'react';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { Provider } from 'next-auth/providers';
import Image from 'next/image';
import { useRouter } from 'next/router';

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

import { SettingsActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

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
      signIn(defaultAuthProvider ?? undefined);
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
          const allowedUrls = ['/', '/marketplace'];
          const url = new URL(callbackUrl.toString(), window.location.origin);
          if (
            url.origin === window.location.origin &&
            allowedUrls.includes(url.pathname)
          ) {
            safeUrl = url.href;
          }
        } catch (e) {
          console.error('Invalid callbackUrl:', e);
        }
      }
      window.location.href = encodeURIComponent(safeUrl);
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
    <div className="flex size-full h-screen items-center justify-center bg-auth-layer-0">
      <div className="mt-8 w-[368px] rounded bg-auth-layer-1 px-8 py-5">
        <div className="my-5 flex justify-center">
          {!!logoImgSrc && (
            <Image src={logoImgSrc} alt="Brand" width={70} height={70} />
          )}
        </div>
        <div className="flex flex-col gap-4">
          {Object.values(providers).map((provider: Provider) => (
            <button
              key={provider.id + provider.name}
              className="button button-secondary flex h-16 content-center justify-center gap-4 px-4 py-3"
              onClick={() => {
                handleSignIn(provider);
              }}
              data-qa={provider.id}
            >
              <span className="flex shrink-0 flex-wrap content-center justify-center">
                <Image
                  className="h-6"
                  src={`https://authjs.dev/img/providers/${provider.id}.svg`}
                  alt="Provider icon"
                  width={24}
                  height={24}
                />
              </span>
              <div className="flex flex-wrap content-center">
                <span className="text-lg">Sign in with {provider.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({
  query,
  req,
  res,
}) => {
  const session = await getServerSession(req, res, authOptions);
  if (session && isServerSessionValid(session)) {
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

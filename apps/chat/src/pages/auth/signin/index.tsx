import { getProviders, signIn, useSession } from 'next-auth/react';
import { useCallback, useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { Provider } from 'next-auth/providers';
import Image from 'next/image';

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
  }, [defaultAuthProvider, session, status]);

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

  return (
    <div className="flex size-full h-screen items-center justify-center bg-auth-layer-0">
      <div className="mt-8 w-[368px] rounded bg-auth-layer-1 px-8 py-5">
        <div className="my-5 flex justify-center">
          <Image
            src={
              process.env.THEMES_CONFIG_HOST
                ? constructPath(
                    process.env.APP_BASE_PATH || '',
                    getThemeIconUrl('favicon'),
                  )
                : ''
            }
            alt="Brand"
            width={70}
            height={70}
          />
        </div>
        <div className="flex flex-col gap-4">
          {Object.values(providers).map((provider: Provider) => (
            <button
              key={provider.id + provider.name}
              className="button button-secondary justify-center"
              onClick={() => {
                handleSignIn(provider);
              }}
            >
              <span>Sign in with {provider.name}</span>
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

  if (session && res && isServerSessionValid(session)) {
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

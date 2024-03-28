import { SessionContextValue, signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { isAuthDisabled } from '../../utils/auth/auth-providers';
import { AuthWindowLocationLike } from '@/src/utils/auth/auth-window-location-like';
import { delay } from '@/src/utils/auth/delay';
import { isServerSessionValid } from '@/src/utils/auth/session';
import { timeoutAsync } from '@/src/utils/auth/timeout-async';

import { StorageType } from '../../types/storage';
import { Translation } from '../../types/translation';

import { AuthActions, AuthSelectors } from '../../store/auth/auth.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  SettingsActions,
  SettingsSelectors,
  SettingsState,
} from '@/src/store/settings/settings.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import { AnnouncementsBanner } from '../../components/Common/AnnouncementBanner';
import { Chat } from '@/src/components/Chat/Chat';

import { Feature } from '@epam/ai-dial-shared';
import { URL } from 'url';

export interface HomeProps {
  initialState: {
    settings: SettingsState;
  };
}

export default function Home({ initialState }: HomeProps) {
  const router = useRouter();
  const { modelId } = router.query;
  const session: SessionContextValue<boolean> = useSession();
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const shouldLogin = useAppSelector(AuthSelectors.selectIsShouldLogin);
  const authStatus = useAppSelector(AuthSelectors.selectStatus);

  const shouldOverlayLogin = isOverlay && shouldLogin;

  // EFFECTS  --------------------------------------------
  useEffect(() => {
    if (!isOverlay && shouldLogin) {
      signIn();
    }
  }, [isOverlay, shouldLogin]);

  useEffect(() => {
    dispatch(AuthActions.setSession(session));
  }, [dispatch, session]);

  // ON LOAD --------------------------------------------

  useEffect(() => {
    // Hack for ios 100vh issue
    const handleSetProperVHPoints = () => {
      document.documentElement.style.setProperty(
        '--vh',
        window.innerHeight * 0.01 + 'px',
      );
      dispatch(UIActions.resize());
    };
    handleSetProperVHPoints();
    window.addEventListener('resize', handleSetProperVHPoints);

    dispatch(SettingsActions.initApp());
  }, [dispatch, initialState]);

  const handleOverlayAuth = async () => {
    const timeout = 30 * 1000;
    let complete = false;
    await Promise.race([
      timeoutAsync(timeout),
      (async () => {
        const authWindowLocation = new AuthWindowLocationLike(
          `api/auth/signin`,
        );

        await authWindowLocation.ready; // ready after redirects
        const t = Math.max(100, timeout / 1000);
        // wait for redirection to back
        while (!complete) {
          try {
            if (authWindowLocation.href === window.location.href) {
              complete = true;
              authWindowLocation.destroy();
              break;
            }
          } catch {
            // Do nothing
          }
          await delay(t);
        }
        window.location.reload();

        return;
      })(),
    ]);
  };

  return (
    <>
      <Head>
        <title className="whitespace-pre">{modelId}</title>
        <meta name="description" content="ChatGPT but better." />
        <meta
          name="viewport"
          content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
        />
      </Head>

      {shouldOverlayLogin ? (
        <div className="grid size-full min-h-[100px] place-items-center bg-layer-1 text-sm text-primary">
          <button
            onClick={handleOverlayAuth}
            className="button button-secondary"
            disabled={authStatus === 'loading'}
          >
            {t('Login')}
          </button>
        </div>
      ) : (
        <main
          // eslint-disable-next-line tailwindcss/enforces-shorthand
          className="h-screen w-screen flex-col bg-layer-1 text-sm text-primary"
          id="theme-main"
        >
          <div className="flex size-full flex-col sm:pt-1">
            <div className="flex w-full grow overflow-auto">
              <div className="flex min-w-0 grow flex-col">
                <h1 className="w-full whitespace-pre text-center text-xl font-semibold">
                  {modelId}
                </h1>
                <AnnouncementsBanner />
                <Chat />
              </div>
            </div>
          </div>
        </main>
      )}
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({
  locale,
  req,
  res,
  params,
}) => {
  const modelId = params?.modelId as string;

  res.setHeader(
    'Content-Security-Policy',
    process.env.ALLOWED_IFRAME_ORIGINS
      ? 'frame-ancestors ' + process.env.ALLOWED_IFRAME_ORIGINS
      : 'frame-ancestors none',
  );

  const session = await getServerSession(req, res, authOptions);
  if (!isServerSessionValid(session)) {
    let params;
    if (req.url) {
      params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    }
    return {
      redirect: {
        permanent: false,
        destination: `/api/auth/signin?callbackUrl=${req.url}${params?.size ? `/?${params.toString()}` : ''}`,
      },
    };
  }

  const settings: SettingsState = {
    appName: '',
    codeWarning: '',
    defaultRecentModelsIds: [],
    defaultRecentAddonsIds: [],
    defaultModelId: modelId,
    enabledFeatures: [
      Feature.TopSettings,
      Feature.TopChatInfo,
      Feature.TopClearConversation,
    ],
    isOverlay: false,
    footerHtmlMessage: '',
    isAuthDisabled,
    storageType: Object.values(StorageType).includes(
      process.env.STORAGE_TYPE as StorageType,
    )
      ? (process.env.STORAGE_TYPE as StorageType)
      : StorageType.API,
    announcement: '',
    themesHostDefined: !!process.env.THEMES_CONFIG_HOST,
    isIsolatedView: true,
    isolatedModelId: modelId,
  };

  return {
    props: {
      appName: settings.appName,
      initialState: {
        settings,
      },
      ...(await serverSideTranslations(
        locale ?? 'en',
        Object.values(Translation),
      )),
    },
  };
};

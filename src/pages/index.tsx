import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';

import { AuthWindowLocationLike } from '@/src/utils/auth/auth-window-location-like';
import { delay } from '@/src/utils/auth/delay';
import {
  isClientSessionValid,
  isServerSessionValid,
} from '@/src/utils/auth/session';
import { timeoutAsync } from '@/src/utils/auth/timeout-async';

import { Translation } from '../types/translation';
import { Feature } from '@/src/types/features';
import { fallbackModelID } from '@/src/types/openai';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  SettingsActions,
  SettingsSelectors,
  SettingsState,
} from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import { Chat } from '@/src/components/Chat/Chat';
import { Chatbar } from '@/src/components/Chatbar/Chatbar';
import Header from '@/src/components/Header/Header';
import { UserMobile } from '@/src/components/Header/User/UserMobile';
import Promptbar from '@/src/components/Promptbar';

import packageJSON from '@/package.json';

interface Props {
  initialState: {
    settings: SettingsState;
  };
}

export default function Home({ initialState }: Props) {
  const session = useSession();

  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);

  const isIframe = useAppSelector(SettingsSelectors.selectIsIframe);
  const authDisabled = useAppSelector(SettingsSelectors.selectIsAuthDisabled);

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  // EFFECTS  --------------------------------------------
  useEffect(() => {
    if (!isIframe && !authDisabled && !isClientSessionValid(session)) {
      signIn();
    }
  }, [isIframe, authDisabled, session]);

  // ON LOAD --------------------------------------------

  useEffect(() => {
    // Hack for ios 100vh issue
    const handleSetProperVHPoints = () => {
      document.documentElement.style.setProperty(
        '--vh',
        window.innerHeight * 0.01 + 'px',
      );
    };
    handleSetProperVHPoints();
    window.addEventListener('resize', handleSetProperVHPoints);

    dispatch(SettingsActions.initApp());
  }, [dispatch, initialState]);

  const handleIframeAuth = async () => {
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

  const shouldIframeLogin =
    isIframe &&
    !authDisabled &&
    (session.status !== 'authenticated' || !isClientSessionValid(session));

  return (
    <>
      <Head>
        <title>{initialState.settings.appName}</title>
        <meta name="description" content="ChatGPT but better." />
        <meta
          name="viewport"
          content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
        />
      </Head>

      {shouldIframeLogin ? (
        <div className="grid h-full min-h-[100px] w-full place-items-center bg-gray-900 text-sm text-gray-200 ">
          <button
            onClick={handleIframeAuth}
            className="appearance-none rounded-lg border-gray-600 p-3 hover:bg-gray-600"
            disabled={session.status === 'loading'}
          >
            {t('Login')}
          </button>
        </div>
      ) : (
        <main
          className={`h-screen w-screen flex-col bg-gray-300 text-sm text-gray-800 dark:bg-gray-900 dark:text-gray-200`}
          id="theme-main"
        >
          <div className={`flex h-full w-full flex-col sm:pt-0`}>
            {enabledFeatures.has(Feature.Header) && <Header />}
            <div className="flex w-full grow overflow-auto">
              {enabledFeatures.has(Feature.ConversationsSection) && <Chatbar />}

              <div className="flex min-w-0 flex-1">
                <Chat />
              </div>

              {enabledFeatures.has(Feature.PromptsSection) && <Promptbar />}
              {isProfileOpen && <UserMobile />}
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
}) => {
  res.setHeader(
    'Content-Security-Policy',
    process.env.ALLOWED_IFRAME_ORIGINS
      ? 'frame-ancestors ' + process.env.ALLOWED_IFRAME_ORIGINS
      : 'frame-ancestors none',
  );

  const session = await getServerSession(req, res, authOptions);
  if (!isServerSessionValid(session)) {
    return {
      redirect: {
        permanent: false,
        destination: `/api/auth/signin`,
      },
    };
  }

  const settings: SettingsState = {
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'AI Dial',
    codeWarning: process.env.CODE_GENERATION_WARNING ?? '',
    defaultModelId: process.env.DEFAULT_MODEL || fallbackModelID,
    defaultRecentModelsIds:
      (process.env.RECENT_MODELS_IDS &&
        process.env.RECENT_MODELS_IDS.split(',')) ||
      [],
    defaultRecentAddonsIds:
      (process.env.RECENT_ADDONS_IDS &&
        process.env.RECENT_ADDONS_IDS.split(',')) ||
      [],
    enabledFeatures: (process.env.ENABLED_FEATURES || '').split(
      ',',
    ) as Feature[],
    isIframe: process.env.IS_IFRAME === 'true' || false,
    footerHtmlMessage: (process.env.FOOTER_HTML_MESSAGE ?? '').replace(
      '%%VERSION%%',
      packageJSON.version,
    ),
    isAuthDisabled: process.env.AUTH_DISABLED === 'true',
    storageType: process.env.STORAGE_TYPE || 'browserStorage',
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

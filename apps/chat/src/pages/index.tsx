import { SessionContextValue, signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';

import { isAuthDisabled } from '../utils/auth/auth-providers';
import { AuthWindowLocationLike } from '@/src/utils/auth/auth-window-location-like';
import { delay } from '@/src/utils/auth/delay';
import { isServerSessionValid } from '@/src/utils/auth/session';
import { timeoutAsync } from '@/src/utils/auth/timeout-async';

import { StorageType } from '../types/storage';
import { Translation } from '../types/translation';
import { fallbackModelID } from '@/src/types/openai';

import { AuthActions, AuthSelectors } from '../store/auth/auth.reducers';
import { ConversationsSelectors } from '../store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  SettingsActions,
  SettingsSelectors,
  SettingsState,
} from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import ChatLoader from '../components/Chat/ChatLoader';
import { AnnouncementsBanner } from '../components/Common/AnnouncementBanner';
import { Chat } from '@/src/components/Chat/Chat';
import { Chatbar } from '@/src/components/Chatbar/Chatbar';
import Header from '@/src/components/Header/Header';
import { UserMobile } from '@/src/components/Header/User/UserMobile';
import Promptbar from '@/src/components/Promptbar';

// eslint-disable-next-line @nx/enforce-module-boundaries
import packageJSON from '../../../../package.json';

import { Feature } from '@epam/ai-dial-shared';

export interface HomeProps {
  initialState: {
    settings: SettingsState;
  };
}

export default function Home({ initialState }: HomeProps) {
  const session: SessionContextValue<boolean> = useSession();

  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const shouldLogin = useAppSelector(AuthSelectors.selectIsShouldLogin);
  const authStatus = useAppSelector(AuthSelectors.selectStatus);
  const shouldOverlayLogin = isOverlay && shouldLogin;
  const areSelectedConversationsLoaded = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsLoaded,
  );

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
        <title>{initialState.settings.appName}</title>
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
          <div className="flex size-full flex-col sm:pt-0">
            {enabledFeatures.has(Feature.Header) && <Header />}
            <div className="flex w-full grow overflow-auto">
              {enabledFeatures.has(Feature.ConversationsSection) && <Chatbar />}

              <div className="flex min-w-0 grow flex-col">
                <AnnouncementsBanner />
                {areSelectedConversationsLoaded ? <Chat /> : <ChatLoader />}
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
    isOverlay: process.env.IS_IFRAME === 'true' || false,
    footerHtmlMessage: (process.env.FOOTER_HTML_MESSAGE ?? '').replace(
      '%%VERSION%%',
      packageJSON.version,
    ),
    isAuthDisabled,
    storageType: Object.values(StorageType).includes(
      process.env.STORAGE_TYPE as StorageType,
    )
      ? (process.env.STORAGE_TYPE as StorageType)
      : StorageType.API,
    announcement: process.env.ANNOUNCEMENT_HTML_MESSAGE || '',
    themesHostDefined: !!process.env.THEMES_CONFIG_HOST,
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

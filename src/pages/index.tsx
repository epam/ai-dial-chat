import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';

import { getSettings } from '@/src/utils/app/settings';
import { AuthWindowLocationLike } from '@/src/utils/auth/auth-window-location-like';
import { delay } from '@/src/utils/auth/delay';
import {
  isClientSessionValid,
  isServerSessionValid,
} from '@/src/utils/auth/session';
import { timeoutAsync } from '@/src/utils/auth/timeout-async';

import { Feature } from '@/src/types/features';
import { FolderInterface } from '@/src/types/folder';
import { fallbackModelID } from '@/src/types/openai';

import { AddonsActions } from '@/src/store/addons/addons.reducers';
import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsActions } from '@/src/store/models/models.reducers';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import {
  SettingsSelectors,
  SettingsState,
} from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { Chat } from '@/src/components/Chat/Chat';
import { Chatbar } from '@/src/components/Chatbar/Chatbar';
import Header from '@/src/components/Header/Header';
import { UserMobile } from '@/src/components/Header/User/UserMobile';
import Promptbar from '@/src/components/Promptbar';

import packageJSON from '@/package.json';
import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

interface Props {
  initialState: {
    settings: SettingsState;
  };
}

const Home = ({ initialState }: Props) => {
  const session = useSession();

  const { t } = useTranslation('chat');

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
    const settings = getSettings();
    if (settings.theme) {
      dispatch(UIActions.setTheme(settings.theme));
    }

    // Hack for ios 100vh issue
    const handleSetProperVHPoints = () => {
      document.documentElement.style.setProperty(
        '--vh',
        window.innerHeight * 0.01 + 'px',
      );
    };
    handleSetProperVHPoints();
    window.addEventListener('resize', handleSetProperVHPoints);

    if (window.innerWidth < 640) {
      dispatch(UIActions.setShowChatbar(false));
      dispatch(UIActions.setShowPromptbar(false));
    }

    const showChatbar = localStorage.getItem('showChatbar');
    if (showChatbar) {
      dispatch(UIActions.setShowChatbar(showChatbar === 'true'));
    }

    const showPromptbar = localStorage.getItem('showPromptbar');
    if (showPromptbar) {
      dispatch(UIActions.setShowPromptbar(showPromptbar === 'true'));
    }

    const openedFoldersIds = localStorage.getItem('openedFoldersIds');
    if (openedFoldersIds) {
      dispatch(UIActions.setOpenedFoldersIds(JSON.parse(openedFoldersIds)));
    }

    const folders = localStorage.getItem('folders');
    if (folders) {
      const parsedFolders: FolderInterface[] = JSON.parse(folders);
      dispatch(
        ConversationsActions.setFolders({
          folders: parsedFolders.filter(({ type }) => type === 'chat'),
        }),
      );
      dispatch(
        PromptsActions.setFolders({
          folders: parsedFolders.filter(({ type }) => type === 'prompt'),
        }),
      );
    }

    const prompts = localStorage.getItem('prompts');
    if (prompts) {
      dispatch(
        PromptsActions.updatePrompts({
          prompts: JSON.parse(localStorage.getItem('prompts') || '[]'),
        }),
      );
    }

    dispatch(
      ModelsActions.initRecentModels({
        defaultRecentModelsIds: initialState.settings.defaultRecentModelsIds,
        localStorageRecentModelsIds: JSON.parse(
          localStorage.getItem('recentModelsIds') || '[]',
        ),
        defaultModelId: initialState.settings.defaultModelId,
      }),
    );

    initialState.settings.defaultRecentAddonsIds &&
      dispatch(
        AddonsActions.initRecentAddons({
          defaultRecentAddonsIds: initialState.settings.defaultRecentAddonsIds,
          localStorageRecentAddonsIds: JSON.parse(
            localStorage.getItem('recentAddonsIds') || '[]',
          ),
        }),
      );

    dispatch(ConversationsActions.initConversations());
    dispatch(ModelsActions.getModels());
    dispatch(AddonsActions.getAddons());
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
            {enabledFeatures.includes('header') && <Header />}
            <div className="flex w-full grow overflow-auto">
              {enabledFeatures.includes('conversations-section') && <Chatbar />}

              <div className="flex min-w-0 flex-1">
                <Chat />
              </div>

              {enabledFeatures.includes('prompts-section') && <Promptbar />}
              {isProfileOpen && <UserMobile />}
            </div>
          </div>
        </main>
      )}
    </>
  );
};
export default Home;

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
  };

  return {
    props: {
      appName: settings.appName,
      initialState: {
        settings,
      },
      ...(await serverSideTranslations(locale ?? 'en', [
        'common',
        'chat',
        'sidebar',
        'markdown',
        'promptbar',
        'settings',
      ])),
    },
  };
};

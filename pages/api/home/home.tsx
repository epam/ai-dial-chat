import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';

import { getSettings } from '@/utils/app/settings';
import { AuthWindowLocationLike } from '@/utils/auth/authWindowLocationLike';
import { delay } from '@/utils/auth/delay';
import { timeoutAsync } from '@/utils/auth/timeoutAsync';

import { Feature } from '@/types/features';
import { FolderInterface } from '@/types/folder';
import { OpenAIEntityModelID, fallbackModelID } from '@/types/openai';

import { AddonsActions } from '@/store/addons/addons.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { ModelsActions } from '@/store/models/models.reducers';
import { PromptsActions } from '@/store/prompts/prompts.reducers';
import { SettingsActions } from '@/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/store/ui/ui.reducers';

import { Chat } from '@/components/Chat/Chat';
import { Chatbar } from '@/components/Chatbar/Chatbar';
import Header from '@/components/Header/Header';
import { UserMobile } from '@/components/Header/User/UserMobile';
import Promptbar from '@/components/Promptbar';

import packageJSON from '../../../package.json';
import { authOptions } from '../auth/[...nextauth]';

interface Props {
  appName: string;
  footerHtmlMessage: string;
  enabledFeatures: Feature[];
  isIframe: boolean;
  authDisabled: boolean;
  defaultModelId: OpenAIEntityModelID;
  defaultRecentModelsIds: string[];
  defaultRecentAddonsIds: string[];
}

const Home = ({
  appName,
  footerHtmlMessage,
  enabledFeatures,
  isIframe,
  defaultModelId,
  authDisabled,
  defaultRecentModelsIds,
  defaultRecentAddonsIds,
}: Props) => {
  const session = useSession();

  const enabledFeaturesSet = new Set(enabledFeatures);
  const { t } = useTranslation('chat');

  const dispatch = useAppDispatch();

  const theme = useAppSelector(UISelectors.selectThemeState);
  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);
  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  // EFFECTS  --------------------------------------------

  useEffect(() => {
    if (window.innerWidth < 640) {
      dispatch(UIActions.setShowChatbar(false));
    }
  }, [selectedConversationIds]);

  // ON LOAD --------------------------------------------

  useEffect(() => {
    defaultModelId &&
      dispatch(ModelsActions.setDefaultModelId({ defaultModelId }));
    footerHtmlMessage &&
      dispatch(SettingsActions.setFooterHtmlMessage(footerHtmlMessage));

    enabledFeaturesSet &&
      dispatch(SettingsActions.setEnabledFeatures(enabledFeaturesSet));

    isIframe && dispatch(SettingsActions.setIsIframe(isIframe));

    defaultRecentModelsIds &&
      dispatch(
        ModelsActions.initRecentModels({
          defaultRecentModelsIds,
          localStorageRecentModelsIds: JSON.parse(
            localStorage.getItem('recentModelsIds') || '[]',
          ),
        }),
      );
    defaultRecentAddonsIds &&
      dispatch(
        AddonsActions.initRecentAddons({
          defaultRecentAddonsIds,
          localStorageRecentAddonsIds: JSON.parse(
            localStorage.getItem('recentAddonsIds') || '[]',
          ),
        }),
      );

    dispatch(ModelsActions.getModels());
    dispatch(AddonsActions.getAddons());

    // Hack for ios 100vh issue
    const handleSetProperVHPoints = () => {
      document.documentElement.style.setProperty(
        '--vh',
        window.innerHeight * 0.01 + 'px',
      );
    };
    handleSetProperVHPoints();
    window.addEventListener('resize', handleSetProperVHPoints);

    const settings = getSettings();
    if (settings.theme) {
      dispatch(UIActions.setTheme(settings.theme));
    }

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

    dispatch(ConversationsActions.initConversations());
  }, []);

  const handleIframeAuth = async () => {
    const timeout = 30 * 1000;
    let complete = false;
    await Promise.race([
      timeoutAsync(timeout),
      (async () => {
        const authWindowLocation = new AuthWindowLocationLike(
          '/api/auth/signin',
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
        <title>{appName}</title>
        <meta name="description" content="ChatGPT but better." />
        <meta
          name="viewport"
          content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {isIframe && !authDisabled && session.status !== 'authenticated' ? (
        <div className="grid h-full min-h-[100px] w-full place-items-center bg-gray-900 text-sm text-gray-200 ">
          <button
            onClick={handleIframeAuth}
            className="appearance-none rounded-lg border-gray-600 p-3 hover:bg-gray-600"
          >
            {t('Login')}
          </button>
        </div>
      ) : (
        <main className={`${theme} `}>
          <div
            className={`theme-main flex h-screen w-screen flex-col bg-gray-300 text-sm text-gray-800 dark:bg-gray-900 dark:text-gray-200`}
            id="theme-main"
          >
            <div className={`flex h-full w-full flex-col sm:pt-0`}>
              {enabledFeaturesSet.has('header') && <Header />}
              <div className="flex w-full grow overflow-auto">
                {enabledFeaturesSet.has('conversations-section') && <Chatbar />}

                <div className="flex flex-1">
                  <Chat appName={appName} />
                </div>

                {enabledFeaturesSet.has('prompts-section') && <Promptbar />}
                {isProfileOpen && <UserMobile />}
              </div>
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
  const isIframe = process.env.IS_IFRAME === 'true' || false;
  res.setHeader(
    'Content-Security-Policy',
    process.env.ALLOWED_IFRAME_ORIGINS
      ? 'frame-ancestors ' + process.env.ALLOWED_IFRAME_ORIGINS
      : 'frame-ancestors none',
  );
  const session = await getServerSession(req, res, authOptions);
  if (!isIframe && process.env.AUTH_DISABLED !== 'true' && !session) {
    return {
      redirect: {
        permanent: false,
        destination: '/api/auth/signin',
      },
    };
  }

  const updatedFooterHTMLMessage = (
    process.env.FOOTER_HTML_MESSAGE ?? ''
  ).replace('%%VERSION%%', packageJSON.version);

  return {
    props: {
      appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Chatbot UI',
      footerHtmlMessage: updatedFooterHTMLMessage,
      enabledFeatures: (process.env.ENABLED_FEATURES || '').split(','),
      isIframe,
      defaultModelId: process.env.DEFAULT_MODEL || fallbackModelID,
      authDisabled: process.env.AUTH_DISABLED === 'true',
      defaultRecentModelsIds:
        (process.env.RECENT_MODELS_IDS &&
          process.env.RECENT_MODELS_IDS.split(',')) ||
        [],
      defaultRecentAddonsIds:
        (process.env.RECENT_ADDONS_IDS &&
          process.env.RECENT_ADDONS_IDS.split(',')) ||
        [],
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

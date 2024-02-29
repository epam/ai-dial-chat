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

import { AuthActions, AuthSelectors } from '../store/auth/auth.reducers';
import { ImportExportSelectors } from '../store/import-export/importExport.reducers';
import { ShareActions, ShareSelectors } from '../store/share/share.reducers';
import {
  selectConversationsToMigrateAndMigratedCount,
  selectFailedMigratedConversations,
} from '@/src/store/conversations/conversations.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  selectFailedMigratedPrompts,
  selectPromptsToMigrateAndMigratedCount,
} from '@/src/store/prompts/prompts.selectors';
import {
  SettingsActions,
  SettingsSelectors,
  SettingsState,
} from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { FALLBACK_MODEL_ID } from '../constants/default-ui-settings';
import { SHARE_QUERY_PARAM } from '../constants/share';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import ShareModal from '../components/Chat/ShareModal';
import { ImportExportLoader } from '../components/Chatbar/ImportExportLoader';
import { AnnouncementsBanner } from '../components/Common/AnnouncementBanner';
import { Chat } from '@/src/components/Chat/Chat';
import { Migration } from '@/src/components/Chat/Migration/Migration';
import { MigrationFailedWindow } from '@/src/components/Chat/Migration/MigrationFailedModal';
import { Chatbar } from '@/src/components/Chatbar/Chatbar';
import Header from '@/src/components/Header/Header';
import { UserMobile } from '@/src/components/Header/User/UserMobile';
import Promptbar from '@/src/components/Promptbar';

// eslint-disable-next-line @nx/enforce-module-boundaries
import packageJSON from '../../../../package.json';

import { Feature } from '@epam/ai-dial-shared';
import { URL } from 'url';

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
  const isShareModalClosed = useAppSelector(
    ShareSelectors.selectShareModalClosed,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const shouldLogin = useAppSelector(AuthSelectors.selectIsShouldLogin);
  const authStatus = useAppSelector(AuthSelectors.selectStatus);
  const { conversationsToMigrateCount, migratedConversationsCount } =
    useAppSelector(selectConversationsToMigrateAndMigratedCount);
  const { promptsToMigrateCount, migratedPromptsCount } = useAppSelector(
    selectPromptsToMigrateAndMigratedCount,
  );
  const failedMigratedConversations = useAppSelector(
    selectFailedMigratedConversations,
  );
  const failedMigratedPrompts = useAppSelector(selectFailedMigratedPrompts);

  const isImportingExporting = useAppSelector(
    ImportExportSelectors.selectIsLoadingImportExport,
  );

  const shouldOverlayLogin = isOverlay && shouldLogin;

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has(SHARE_QUERY_PARAM)) {
      dispatch(
        ShareActions.acceptShareInvitation({
          invitationId: searchParams.get(SHARE_QUERY_PARAM)!,
        }),
      );
    }
  }, [dispatch]);

  // EFFECTS  --------------------------------------------
  useEffect(() => {
    if (!isOverlay && shouldLogin) {
      signIn(undefined, { callbackUrl: '/?share=123' });
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

  if (conversationsToMigrateCount !== 0 || promptsToMigrateCount !== 0) {
    if (
      conversationsToMigrateCount + promptsToMigrateCount ===
      migratedPromptsCount + migratedConversationsCount
    ) {
      return window.location.reload();
    }
  }

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
          {conversationsToMigrateCount + promptsToMigrateCount !==
          migratedPromptsCount + migratedConversationsCount ? (
            <Migration
              total={conversationsToMigrateCount + promptsToMigrateCount}
              uploaded={migratedPromptsCount + migratedConversationsCount}
            />
          ) : failedMigratedConversations.length ||
            failedMigratedPrompts.length ? (
            <MigrationFailedWindow
              failedMigratedConversations={failedMigratedConversations}
              failedMigratedPrompts={failedMigratedPrompts}
            />
          ) : (
            <div className="flex size-full flex-col sm:pt-0">
              {enabledFeatures.has(Feature.Header) && <Header />}
              <div className="flex w-full grow overflow-auto">
                {enabledFeatures.has(Feature.ConversationsSection) && (
                  <Chatbar />
                )}

                <div className="flex min-w-0 grow flex-col">
                  <AnnouncementsBanner />
                  <Chat />

                  {isImportingExporting && (
                    <ImportExportLoader isOpen={isImportingExporting} />
                  )}
                </div>
                {enabledFeatures.has(Feature.PromptsSection) && <Promptbar />}
                {isProfileOpen && <UserMobile />}
                {!isShareModalClosed && <ShareModal />}
              </div>
            </div>
          )}
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
    let params;
    if (req.url) {
      params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    }
    return {
      redirect: {
        permanent: false,
        destination: `api/auth/signin${params?.size ? `?callbackUrl=/?${params.toString()}` : ''}`,
      },
    };
  }

  const settings: SettingsState = {
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'AI Dial',
    codeWarning: process.env.CODE_GENERATION_WARNING ?? '',
    defaultModelId: process.env.DEFAULT_MODEL || FALLBACK_MODEL_ID,
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

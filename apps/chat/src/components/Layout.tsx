import { SessionContextValue, signIn, useSession } from 'next-auth/react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import { useRouter } from 'next/router';

import { AuthWindowLocationLike } from '@/src/utils/auth/auth-window-location-like';
import { delay } from '@/src/utils/auth/delay';
import { timeoutAsync } from '@/src/utils/auth/timeout-async';

import { Translation } from '../types/translation';
import { PageType } from '@/src/types/common';

import { AuthActions, AuthSelectors } from '../store/auth/auth.reducers';
import { MarketplaceSelectors } from '../store/marketplace/marketplace.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  SettingsActions,
  SettingsSelectors,
  SettingsState,
} from '@/src/store/settings/settings.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import Loader from './Common/Loader';

const getPageType = (route?: string) => {
  switch (route) {
    case '/marketplace':
      return PageType.Marketplace;
    default:
      return PageType.Chat;
  }
};

export default function Layout({
  children,
  settings,
}: {
  children: React.ReactNode;
  settings: SettingsState;
}) {
  const router = useRouter();
  const session: SessionContextValue<boolean> = useSession();

  const { t } = useTranslation(Translation.Chat);
  const isApplyingModel = useAppSelector(
    MarketplaceSelectors.selectIsApplyingModel,
  );
  const [loading, setLoading] = useState(isApplyingModel);

  const dispatch = useAppDispatch();

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const shouldLogin = useAppSelector(AuthSelectors.selectIsShouldLogin);
  const authStatus = useAppSelector(AuthSelectors.selectStatus);

  const isSignInInSameWindow = useAppSelector(
    SettingsSelectors.selectIsSignInInSameWindow,
  );

  const shouldOverlayLogin = isOverlay && shouldLogin;
  const handleStartRedirecting = useCallback(() => setLoading(true), []);
  const handleStopRedirecting = useCallback(() => setLoading(false), []);

  // EFFECTS  --------------------------------------------
  useEffect(() => {
    setLoading(isApplyingModel);
  }, [isApplyingModel]);
  useEffect(() => {
    router.events.on('routeChangeStart', handleStartRedirecting);
    router.events.on('routeChangeComplete', handleStopRedirecting);
    router.events.on('routeChangeError', handleStopRedirecting);
    return () => {
      router.events.off('routeChangeStart', handleStartRedirecting);
      router.events.off('routeChangeComplete', handleStopRedirecting);
      router.events.off('routeChangeError', handleStopRedirecting);
    };
  }, [handleStartRedirecting, handleStopRedirecting, router.events]);
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

    dispatch(SettingsActions.initApp(getPageType(router.route)));
  }, [dispatch, settings, router.route]);

  const handleOverlayAuth = async () => {
    const timeout = 30 * 1000;
    let complete = false;
    await Promise.race([
      timeoutAsync(timeout),
      (async () => {
        const authWindowLocation = new AuthWindowLocationLike(
          `api/auth/signin`,
          isSignInInSameWindow,
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
        <title className="whitespace-pre">{settings?.appName}</title>
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
          {children}
        </main>
      )}
      {loading && (
        <Loader containerClassName="absolute bg-blackout size-full top-0 z-50" />
      )}
    </>
  );
}

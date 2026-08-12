import { FloatingOverlay } from '@floating-ui/react';
import { SessionContextValue, signIn, useSession } from 'next-auth/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useRouteHistory } from '@/src/hooks/useRouteHistory';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getPageType } from '@/src/utils/app/route';
import { signInInOverlay } from '@/src/utils/auth/auth-overlay';

import { Translation } from '@/src/types/translation';

import { AuthActions, SettingsActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  AuthSelectors,
  ChatEventsSelectors,
  MarketplaceSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';
import { SettingsState } from '@/src/store/settings/settings.types';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { NavigationWrapper } from '@/src/components/Navigation/NavigationWrapper';

import { Loader } from './Common/Loader';
import { Title } from './Title';

import { DialNeutralButton } from '@epam/ai-dial-ui-kit';

const removeQueryString = (url: string) => url.split('?')[0];

export function Layout({
  children,
  settings,
}: {
  children: React.ReactNode;
  settings: SettingsState;
}) {
  const router = useRouter();
  const session: SessionContextValue<boolean> = useSession();

  const { t } = useTranslation(Translation.Chat);

  const { previousRoute } = useRouteHistory();

  const dispatch = useAppDispatch();

  const isSubscribed = useAppSelector(ChatEventsSelectors.selectIsSubscribed);
  const channelId = useAppSelector(ChatEventsSelectors.selectChannelId);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const shouldLogin = useAppSelector(AuthSelectors.selectIsShouldLogin);
  const authStatus = useAppSelector(AuthSelectors.selectStatus);
  const isSignInInSameWindow = useAppSelector(
    SettingsSelectors.selectIsSignInInSameWindow,
  );
  const isApplyingModel = useAppSelector(
    MarketplaceSelectors.selectIsApplyingModel,
  );
  const isEditorLoader = useAppSelector(UISelectors.selectIsEditorLoader);
  const isAnyMenuOpen = useAppSelector((state) =>
    UISelectors.selectIsAnyMenuOpen(state, router.pathname),
  );
  const isIsolatedView = useAppSelector(SettingsSelectors.selectIsIsolatedView);
  const isMdSidebarOverlayBreakpoint = useAppSelector(
    SettingsSelectors.selectIsMdSidebarOverlayBreakpoint,
  );
  const [loading, setLoading] = useState(isApplyingModel);

  const initializedRouteRef = useRef<string | null>(null);

  const showFloatingOverlay = isAnyMenuOpen && !isIsolatedView;

  const handleCloseOverlay = useCallback(() => {
    dispatch(UIActions.closeAllPanels());
  }, [dispatch]);

  const shouldOverlayLogin = isOverlay && shouldLogin;

  const handleStartRedirecting = useCallback((url: string) => {
    setLoading(removeQueryString(url) !== window.location.pathname);
  }, []);
  const handleStopRedirecting = useCallback(() => setLoading(false), []);

  // EFFECTS  --------------------------------------------
  useEffect(() => {
    if (previousRoute) {
      dispatch(UIActions.setPreviousRoute(previousRoute));
    }
  }, [dispatch, previousRoute]);

  useEffect(() => {
    const locale = router.locale ?? router.defaultLocale ?? 'en';

    dispatch(UIActions.setLocale(locale));
  }, [dispatch, router.defaultLocale, router.locale]);
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
    const handleResize = () => {
      dispatch(UIActions.resize());
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dispatch]);

  useEffect(() => {
    if (initializedRouteRef.current === router.route) {
      return;
    }

    initializedRouteRef.current = router.route;
    dispatch(SettingsActions.initApp(getPageType(router.route)));
  }, [dispatch, settings, router.route]);

  const handleOverlayAuth = async () => {
    signInInOverlay(`/api/auth/signin`, isSignInInSameWindow);
  };

  useEffect(() => {
    let unsubscribed = false;

    const handleCloseTab = () => {
      if (unsubscribed || !isSubscribed) return;
      navigator.sendBeacon(
        '/api/client-channels/unsubscribe',
        JSON.stringify({ channelId }),
      );
      unsubscribed = true;
    };
    window.addEventListener('beforeunload', handleCloseTab);
    window.addEventListener('pagehide', handleCloseTab);

    return () => {
      window.removeEventListener('beforeunload', handleCloseTab);
      window.removeEventListener('pagehide', handleCloseTab);
    };
  }, [channelId, isSubscribed]);

  return (
    <>
      <Title settings={settings} />
      {shouldOverlayLogin ? (
        <div className="grid h-screen w-full place-items-center bg-auth-layer-0 text-sm text-primary">
          <DialNeutralButton
            label={t(ChatI18nKeys.Login)}
            onClick={handleOverlayAuth}
            disabled={authStatus === 'loading'}
          />
        </div>
      ) : (
        <main
          className="h-screen w-screen flex-col bg-layer-1 text-sm text-primary"
          id="theme-main"
        >
          {showFloatingOverlay && (
            <FloatingOverlay
              className={classNames(
                'z-40 bg-blackout',
                isMdSidebarOverlayBreakpoint
                  ? 'sidebar-overlay-md:hidden'
                  : 'sidebar-overlay:hidden',
              )}
              onClick={handleCloseOverlay}
            />
          )}
          <NavigationWrapper>{children}</NavigationWrapper>
        </main>
      )}
      {(loading || isEditorLoader) && (
        <Loader containerClassName="absolute bg-blackout size-full top-0 z-50" />
      )}
    </>
  );
}

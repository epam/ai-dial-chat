import { FloatingOverlay } from '@floating-ui/react';
import { SessionContextValue, signIn, useSession } from 'next-auth/react';
import React, { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'next/router';

import { useRouteHistory } from '@/src/hooks/useRouteHistory';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getPageType } from '@/src/utils/app/route';
import { signInInOverlay } from '@/src/utils/auth/auth-overlay';

import { ScreenState } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { AuthActions, SettingsActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  AuthSelectors,
  MarketplaceSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';
import { SettingsState } from '@/src/store/settings/settings.types';

import { NavigationWrapper } from '@/src/components/Navigation/NavigationWrapper';

import { Loader } from './Common/Loader';
import { Title } from './Title';

import { ButtonVariant, DialButton } from '@epam/ai-dial-ui-kit';

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

  const screenState = useScreenState();

  const [loading, setLoading] = useState(isApplyingModel);

  const showFloatingOverlay =
    screenState <= ScreenState.MD && isAnyMenuOpen && !isIsolatedView;

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
    signInInOverlay(`/api/auth/signin`, isSignInInSameWindow);
  };

  return (
    <>
      <Title settings={settings} />
      {shouldOverlayLogin ? (
        <div className="grid h-screen w-full place-items-center bg-auth-layer-0 text-sm text-primary">
          <DialButton
            label={t('Login')}
            variant={ButtonVariant.Secondary}
            onClick={handleOverlayAuth}
            disabled={authStatus === 'loading'}
          />
        </div>
      ) : (
        <main
          // eslint-disable-next-line tailwindcss/enforces-shorthand
          className="h-screen w-screen flex-col bg-layer-1 text-sm text-primary"
          id="theme-main"
        >
          {showFloatingOverlay && (
            <FloatingOverlay
              className="z-30 bg-blackout"
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

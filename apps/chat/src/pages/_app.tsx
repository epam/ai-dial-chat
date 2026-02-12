import { SessionProvider, SessionProviderProps } from 'next-auth/react';
import { ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';

import { NextPage } from 'next';
import { appWithTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import Head from 'next/head';

import { getThemeIconUrl } from '@/src/utils/app/themes';

import { SettingsState } from '@/src/store/settings/settings.types';

import { Toasts } from '@/src/components/Toasts/Toasts';

import { HomeProps } from '.';
import { getLayout, inter } from '../layout';
import '../styles/globals.css';

import { createStore } from '@/src/store';
import { appWithJss } from '@epam/ai-dial-modulify-ui';

export type NextPageWithLayout<P = object, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement, settings: SettingsState) => ReactNode;
};

type AppPropsWithLayout = AppProps<SessionProviderProps & HomeProps> & {
  Component: NextPageWithLayout;
};

function App({ Component, ...rest }: AppPropsWithLayout) {
  const store = createStore({
    settings: rest.pageProps.initialState?.settings,
  });

  const getPage = Component.getLayout ?? ((page) => page);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
        />
        {process.env.NODE_ENV !== 'development' && (
          <>
            <link
              rel="icon"
              href={getThemeIconUrl('favicon')}
              sizes="any"
              type="image/png"
            />
            <link
              rel="apple-touch-icon"
              href={getThemeIconUrl('favicon')}
              type="image/png"
            />
          </>
        )}
      </Head>
      <SessionProvider session={rest.pageProps.session} basePath={'/api/auth'}>
        <Provider store={store}>
          <div className={`${inter.variable} font`}>
            <Toasts />
            {getPage(
              <Component {...rest.pageProps} />,
              rest.pageProps.initialState?.settings,
            )}
          </div>
        </Provider>
      </SessionProvider>
    </>
  );
}

export default appWithJss(appWithTranslation(App));

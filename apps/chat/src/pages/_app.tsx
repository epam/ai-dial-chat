import { SessionProvider, SessionProviderProps } from 'next-auth/react';
import { ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';

import { NextPage } from 'next';
import { appWithTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import { Inconsolata, Inter } from 'next/font/google';

import { SettingsState } from '@/src/store/settings/settings.reducers';

import Layout from '../components/Layout';
import { Toasts } from '../components/Toasts/Toasts';

import { HomeProps } from '.';

import { createStore } from '@/src/store';
import '@/src/styles/globals.css';
import { appWithJss } from '@epam/ai-dial-modulify-ui';

export type NextPageWithLayout<P = object, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement, settings: SettingsState) => ReactNode;
};

export function getLayout(page: ReactElement, settings: SettingsState) {
  return <Layout settings={settings}>{page}</Layout>;
}

export const inter = Inter({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-inter',
});
export const inconsolata = Inconsolata({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-inconsolata',
});

type AppPropsWithLayout = AppProps<SessionProviderProps & HomeProps> & {
  Component: NextPageWithLayout;
};

function App({ Component, ...rest }: AppPropsWithLayout) {
  const store = createStore({
    settings: rest.pageProps.initialState?.settings,
  });

  const getPage = Component.getLayout ?? ((page) => page);

  return (
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
  );
}

export default appWithJss(appWithTranslation(App));

import { SessionProvider, SessionProviderProps } from 'next-auth/react';
import { Provider } from 'react-redux';

import { appWithTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import { Inconsolata, Inter } from 'next/font/google';

import Layout from '../components/Layout';
import { Toasts } from '../components/Toasts/Toasts';

import { HomeProps } from '.';

import { createStore } from '@/src/store';
import '@/src/styles/globals.css';

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

function App({
  Component,
  ...rest
}: AppProps<SessionProviderProps & HomeProps>) {
  const store = createStore({
    settings: rest.pageProps.initialState?.settings,
  });

  return (
    <SessionProvider session={rest.pageProps.session} basePath={'api/auth'}>
      <Provider store={store}>
        <div className={`${inter.variable} font`}>
          <Toasts />
          <Layout settings={rest.pageProps.initialState?.settings}>
            <Component {...rest.pageProps} />
          </Layout>
        </div>
      </Provider>
    </SessionProvider>
  );
}

export default appWithTranslation(App);

import { IconAlertCircle, IconX } from '@tabler/icons-react';
import { SessionProvider, SessionProviderProps } from 'next-auth/react';
import toast, { ToastBar, Toaster } from 'react-hot-toast';
import CacheProvider from 'react-inlinesvg/provider';
import { Provider } from 'react-redux';

import { appWithTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';

import classNames from 'classnames';

import { HomeProps } from '.';

import { createStore } from '@/src/store';
import '@/src/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-inter',
});

function App({
  Component,
  ...rest
}: AppProps<SessionProviderProps & HomeProps>) {
  const store = createStore({
    settings: rest.pageProps.initialState?.settings,
  });

  return (
    <CacheProvider>
      <SessionProvider session={rest.pageProps.session} basePath={'api/auth'}>
        <Provider store={store}>
          <div className={`${inter.variable} font`}>
            <Toaster toastOptions={{ duration: 9000 }}>
              {(t) => (
                <ToastBar
                  style={{
                    backgroundColor:
                      t.type === 'error'
                        ? 'var(--bg-error)'
                        : 'var(--bg-layer-3)',
                    borderRadius: '3px',
                    maxWidth: '730px',
                    padding: '16px 10px',
                  }}
                  toast={t}
                >
                  {({ icon, message }) => (
                    <>
                      <span>
                        {t.type === 'error' ? (
                          <IconAlertCircle
                            size={24}
                            className="text-error"
                            stroke={1.5}
                          />
                        ) : (
                          icon
                        )}
                      </span>
                      <div
                        className={classNames(
                          'mx-0.5 text-sm leading-[21px]',
                          t.type === 'error' ? 'text-error' : 'text-primary',
                        )}
                      >
                        {message}
                      </div>
                      {t.type !== 'loading' && (
                        <button onClick={() => toast.dismiss(t.id)}>
                          <IconX
                            stroke={1}
                            size={24}
                            className="text-secondary"
                          />
                        </button>
                      )}
                    </>
                  )}
                </ToastBar>
              )}
            </Toaster>
            <Component {...rest.pageProps} />
          </div>
        </Provider>
      </SessionProvider>
    </CacheProvider>
  );
}

export default appWithTranslation(App);

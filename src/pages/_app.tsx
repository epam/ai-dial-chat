import { IconX } from '@tabler/icons-react';
import { SessionProvider, SessionProviderProps } from 'next-auth/react';
import toast, { ToastBar, Toaster } from 'react-hot-toast';
import { Provider } from 'react-redux';

import { appWithTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';

import { store } from '@/src/store';
import '@/src/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-inter',
});

function App({ Component, pageProps }: AppProps<SessionProviderProps>) {
  return (
    <SessionProvider session={pageProps.session}>
      <Provider store={store}>
        <div className={`${inter.variable} font`}>
          <Toaster toastOptions={{ duration: 9000 }}>
            {(t) => (
              <ToastBar toast={t}>
                {({ icon, message }) => (
                  <>
                    {icon}
                    {message}
                    {t.type !== 'loading' && (
                      <button onClick={() => toast.dismiss(t.id)}>
                        <IconX />
                      </button>
                    )}
                  </>
                )}
              </ToastBar>
            )}
          </Toaster>
          <Component {...pageProps} />
        </div>
      </Provider>
    </SessionProvider>
  );
}

export default appWithTranslation(App);

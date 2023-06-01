import { IconX } from '@tabler/icons-react';
import { SessionProvider, SessionProviderProps } from 'next-auth/react';
import toast, { ToastBar, Toaster, resolveValue } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from 'react-query';

import { appWithTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';

import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], weight: 'variable' });

function App({ Component, pageProps }: AppProps<SessionProviderProps>) {
  const queryClient = new QueryClient();

  return (
    <SessionProvider session={pageProps.session}>
      <div className={inter.className}>
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
        <QueryClientProvider client={queryClient}>
          <Component {...pageProps} />
        </QueryClientProvider>
      </div>
    </SessionProvider>
  );
}

export default appWithTranslation(App);

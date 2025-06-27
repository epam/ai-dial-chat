import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import {
  DEFAULT_PROVIDER,
  authProviders,
} from '@/src/utils/auth/auth-providers';
import { isClientSessionValid } from '@/src/utils/auth/session';

interface PageProps {
  provider?: string;
}

export default function Signin(props: PageProps) {
  const { provider: defaultAuthProvider } = props;
  const router = useRouter();
  const { status, ...session } = useSession();

  useEffect(() => {
    if (status === 'loading') return;
    if (
      status === 'unauthenticated' ||
      !isClientSessionValid(session) ||
      !session.data
    ) {
      signIn(defaultAuthProvider ?? undefined);
    } else if (status === 'authenticated') {
      const { callbackUrl } = router.query;
      const safeUrl = callbackUrl ? callbackUrl.toString() : '/';
      window.location.href = safeUrl;
    }
  }, [status, router, defaultAuthProvider, session]);

  return null;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { provider } = context.query; // Extract parameter from the URL
  const checkProvider = authProviders.some(({ id }) => id === provider);
  const providerFromQuery = checkProvider ? provider : undefined;
  return {
    props: {
      provider: DEFAULT_PROVIDER ?? providerFromQuery,
    },
  };
};

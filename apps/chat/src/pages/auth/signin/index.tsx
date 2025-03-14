import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { DEFAULT_PROVIDER } from '@/src/utils/auth/auth-providers';
import { isClientSessionValid } from '@/src/utils/auth/session';

import { sanitizeUri } from 'micromark-util-sanitize-uri';

interface PageProps {
  provider?: string;
}

export default function Signin(props: PageProps) {
  const { provider: defaultAuthProvider } = props;
  const router = useRouter();
  const { status, ...session } = useSession();

  useEffect(() => {
    if (
      status === 'unauthenticated' ||
      !isClientSessionValid(session) ||
      !session.data
    ) {
      signIn(defaultAuthProvider ?? undefined);
    } else if (status === 'authenticated') {
      const { callbackUrl } = router.query;
      const safeUrl = callbackUrl ? sanitizeUri(callbackUrl.toString()) : '/';
      window.location.href = safeUrl;
    }
  }, [status, router, defaultAuthProvider, session]);

  return null;
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      provider: DEFAULT_PROVIDER,
    },
  };
};

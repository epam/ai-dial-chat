import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { sanitizeUri } from 'micromark-util-sanitize-uri';

interface PageProps {
  defaultAuthProvider?: string;
}

export default function Signin({ defaultAuthProvider }: PageProps) {
  const router = useRouter();
  const { status } = useSession();
  useEffect(() => {
    if (status === 'unauthenticated') {
      signIn(defaultAuthProvider);
    } else if (status === 'authenticated') {
      const { callbackUrl } = router.query;
      const safeUrl = callbackUrl ? sanitizeUri(callbackUrl.toString()) : '/';

      router.push(safeUrl);
    }
  }, [status, router, defaultAuthProvider]);

  return <div></div>;
}

export const getServerSideProps = getCommonPageProps;

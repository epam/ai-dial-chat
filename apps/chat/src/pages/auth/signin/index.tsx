import { signIn, useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

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
      router.push('/');
    }
  }, [status, router, defaultAuthProvider]);

  return <div></div>;
}

export const getServerSideProps = getCommonPageProps;

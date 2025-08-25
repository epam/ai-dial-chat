import { useCallback, useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { useRouter } from 'next/router';

import { isServerSessionValid } from '@/src/utils/auth/session';

import { ToolsetCredentialsLevel } from '@/src/types/toolsets';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import { Spinner } from '@/src/components/Common/Spinner';

interface RedirectState {
  toolset: string;
  level?: ToolsetCredentialsLevel;
  application?: string;
  callbackUrl?: string;
}

export default function ToolsetSignin() {
  const router = useRouter();

  const handleRedirect = useCallback((stateQuery?: string) => {
    let state: RedirectState | undefined;
    try {
      state = JSON.parse(stateQuery ?? '');
    } catch {
      state = undefined;
    }

    let callbackUrl = '/';
    try {
      const url = new URL(state?.callbackUrl ?? '', window.location.origin);
      if (url.origin === window.location.origin) {
        callbackUrl = url.href;
      }
    } catch (e) {
      console.error('Invalid callbackUrl: ', e);
    }

    window.location.href = callbackUrl;
  }, []);

  useEffect(() => {
    const { code = '', state = '' } = router.query;

    if (!code) {
      console.error('Toolset signin failed');
    }

    console.log('Code: ', code?.slice(0, 5));
    console.log('State: ', state);

    handleRedirect(state.toString());
  }, [handleRedirect, router]);

  return (
    <div className="flex h-full items-center justify-center bg-auth-layer-1">
      <Spinner size={45} className="mx-auto" />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const session = await getServerSession(req, res, authOptions);

  if (!isServerSessionValid(session, true)) {
    return {
      redirect: {
        permanent: false,
        destination: '/signin',
      },
    };
  }

  return {
    props: {
      isSessionValid: false,
    },
  };
};

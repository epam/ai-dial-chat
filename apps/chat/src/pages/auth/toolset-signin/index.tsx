import { useEffect } from 'react';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { useRouter } from 'next/router';

import { isServerSessionValid } from '@/src/utils/auth/session';

import { ToolsetCredentialsLevel } from '@/src/types/toolsets';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import { Spinner } from '@/src/components/Common/Spinner';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

interface RedirectState {
  toolsetId: string;
  credentialsLevel?: ToolsetCredentialsLevel;
  callbackUrl?: string;
}

export default function ToolsetSignin() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const { code = '', state = '' } = router.query;
    let parsedState: RedirectState;

    window.history.replaceState({}, document.title, window.location.pathname);

    try {
      parsedState = JSON.parse(decodeURIComponent(state.toString())) as RedirectState;
    } catch {
      console.error('Invalid state');
      window.location.assign(window.location.origin);
      return;
    }
    if (!code || !parsedState.toolsetId) {
      console.error('Toolset signin failed');
      window.location.assign(window.location.origin);
      return;
    }

    console.log('Code: ', code.toString());
    console.log('State: ', parsedState);

    dispatch(
      ToolsetActions.logInToolset({
        toolsetId: parsedState.toolsetId,
        authLevel: parsedState.credentialsLevel ?? ToolsetCredentialsLevel.GLOBAL,
        authType: ToolsetAuthTypes.OAUTH,
        callbackUrl: parsedState.callbackUrl,
        code: code.toString(),
      }),
    );
  }, [dispatch, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-auth-layer-1">
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

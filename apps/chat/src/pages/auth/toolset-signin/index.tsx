import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { decodeToolsetRedirectState } from '@/src/utils/app/toolsets';
import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import {
  ToolsetCredentialsLevel,
  ToolsetRedirectState,
} from '@/src/types/toolsets';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { Spinner } from '@/src/components/Common/Spinner';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

function ToolsetSignin() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const { code = '', state = '' } = router.query;
    let parsedState: ToolsetRedirectState;

    window.history.replaceState({}, document.title, window.location.pathname);

    try {
      parsedState = decodeToolsetRedirectState(state.toString());
    } catch {
      console.error('Invalid state');
      window.location.assign(window.location.origin);
      return;
    }

    let callbackUrl = '/';
    try {
      const url = new URL(
        parsedState.callbackUrl ?? '',
        window.location.origin,
      );
      if (url.origin === window.location.origin) {
        callbackUrl = url.href;
      }
    } catch {
      console.error('Invalid callback url');
    }

    if (!code || !parsedState.toolsetId) {
      console.error('Toolset signin failed');
      window.location.assign(callbackUrl);
      return;
    }

    dispatch(
      ToolsetActions.logInToolset({
        toolsetId: parsedState.toolsetId,
        authLevel:
          parsedState.credentialsLevel ?? ToolsetCredentialsLevel.GLOBAL,
        authType: ToolsetAuthTypes.OAUTH,
        callbackUrl,
        code: code.toString(),
        isAdmin: parsedState.isAdmin,
      }),
    );
  }, [dispatch, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-auth-layer-1">
      <Spinner size={45} className="mx-auto" />
    </div>
  );
}

export default ToolsetSignin;

export const getServerSideProps = getCommonPageProps;

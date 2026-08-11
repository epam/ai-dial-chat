import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { decodeToolsetRedirectState } from '@/src/utils/app/toolsets';
import {
  isToolsetAuthPopup,
  postToolsetAuthResult,
} from '@/src/utils/auth/auth-toolset';
import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import {
  ToolsetAuthErrorDetails,
  ToolsetAuthErrorReason,
  ToolsetCredentialsLevel,
  ToolsetRedirectState,
} from '@/src/types/toolsets';

import { ToolsetActions } from '@/src/store/actions';
import { useAppDispatch } from '@/src/store/hooks';

import { QUERY_VALUE_FALSE } from '@/src/constants/routes';
import { ToolsetLoginQuery } from '@/src/constants/toolsets';

import { Spinner } from '@/src/components/Common/Spinner';

import { ToolsetAuthTypes } from '@epam/ai-dial-shared';

function ToolsetSignin() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const {
      code = '',
      state = '',
      [ToolsetLoginQuery.LoginComplete]: loginComplete,
      [ToolsetLoginQuery.Error]: providerError,
      [ToolsetLoginQuery.ErrorDescription]: providerErrorDescription,
      [ToolsetLoginQuery.ErrorUri]: providerErrorUri,
    } = router.query;

    if (loginComplete) return;

    const isPopup = isToolsetAuthPopup();
    let callbackUrl = '/';

    const reportFailure = (details: ToolsetAuthErrorDetails) => {
      console.error(`Toolset sign in failed: ${details.reason}`, details);

      if (!isPopup) {
        window.location.assign(callbackUrl);
        return;
      }

      postToolsetAuthResult({ ok: false, error: details });

      void router.push(
        {
          pathname: router.pathname,
          query: {
            [ToolsetLoginQuery.LoginComplete]: QUERY_VALUE_FALSE,
            ...(details.reason && {
              [ToolsetLoginQuery.Reason]: details.reason,
            }),
            ...(details.traceId && {
              [ToolsetLoginQuery.TraceId]: details.traceId,
            }),
          },
        },
        undefined,
        { shallow: true },
      );
    };

    let parsedState: ToolsetRedirectState | undefined = undefined;

    try {
      parsedState = decodeToolsetRedirectState(state.toString());
    } catch (err) {
      console.error('Could not decode the toolset redirect state', err);
    }

    try {
      const url = new URL(
        parsedState?.callbackUrl ?? '',
        window.location.origin,
      );
      if (url.origin === window.location.origin) {
        callbackUrl = url.href;
      }
    } catch (err) {
      console.error('Invalid callback url', err);
    }

    window.history.replaceState({}, document.title, window.location.pathname);

    if (providerError) {
      reportFailure({
        reason: ToolsetAuthErrorReason.ProviderError,
        code: providerError.toString(),
        message: providerErrorDescription?.toString(),
        uri: providerErrorUri?.toString(),
      });
      return;
    }

    if (!parsedState) {
      reportFailure({
        reason: ToolsetAuthErrorReason.InvalidState,
        code: 'invalid_state',
      });
      return;
    }

    if (!code || !parsedState.toolsetId) {
      reportFailure({
        reason: ToolsetAuthErrorReason.MissingCode,
        code: !code ? 'no_authorization_code' : 'no_toolset_id',
      });
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
        isPopup,
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

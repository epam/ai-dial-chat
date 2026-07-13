import type { ToolsetLoginBodyDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { TOOLSET_REDIRECT_STATE_KEY } from '../../constants/toolsets';
import { loginToolset } from '../../server-api/toolsets';
import { ROUTES } from '../../types/routes';
import type { ToolsetRedirectState } from '../../types/toolsets';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
} from '../../types/toolsets';

const readRedirectState = (): ToolsetRedirectState | null => {
  const raw = sessionStorage.getItem(TOOLSET_REDIRECT_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ToolsetRedirectState;
  } catch {
    return null;
  }
};

/**
 * This route only ever runs inside the popup window opened by
 * `initiateOAuthLogin` — it always closes the window on completion rather
 * than navigating, since the editor/Catalog tab that opened it never
 * navigated away.
 */
const ToolsetEditorCallback: FC = () => {
  const [searchParams] = useSearchParams();
  // Guard against React 18 StrictMode double-invocation of the effect.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const complete = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const redirectState = readRedirectState();
      sessionStorage.removeItem(TOOLSET_REDIRECT_STATE_KEY);

      if (!code || !redirectState?.toolsetId) {
        window.close();
        return;
      }

      if (redirectState.state != null && redirectState.state !== state) {
        window.close();
        return;
      }

      try {
        const body: ToolsetLoginBodyDto = {
          url: redirectState.toolsetId,
          credentialsLevel: (redirectState.credentialsLevel ??
            ToolsetCredentialsLevel.User) as ToolsetLoginBodyDto['credentialsLevel'],
          authenticationType:
            ToolsetAuthTypes.OAuth as ToolsetLoginBodyDto['authenticationType'],
          code,
          redirectUri: `${window.location.origin}${ROUTES.ToolsetEditorCallback}`,
        };
        await loginToolset(redirectState.toolsetId, body);
      } catch {
        // Swallow — the opener will reflect the not-logged-in state once reopened.
      } finally {
        window.close();
      }
    };

    void complete();
  }, [searchParams]);

  return <RouteFallback />;
};

export default memo(ToolsetEditorCallback);

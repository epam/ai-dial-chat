import type { ToolsetLoginBodyDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const ToolsetEditorCallback: FC = () => {
  const navigate = useNavigate();
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
        navigate(ROUTES.Catalog, { replace: true });
        return;
      }

      if (redirectState.state != null && redirectState.state !== state) {
        navigate(ROUTES.Catalog, { replace: true });
        return;
      }

      const fallback = redirectState.callbackUrl ?? ROUTES.Catalog;
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
        // Swallow — the editor will reflect the not-logged-in state on return.
      } finally {
        navigate(fallback, { replace: true });
      }
    };

    void complete();
  }, [navigate, searchParams]);

  return <RouteFallback />;
};

export default memo(ToolsetEditorCallback);

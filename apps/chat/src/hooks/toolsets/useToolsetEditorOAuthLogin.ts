import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import {
  initiateOAuthLogin,
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
  ToolsetCredentialsLevel,
  type ToolsetOAuthInitiationResult,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
  waitForToolsetOAuthResult,
  WithLogin,
} from '@epam/ai-dial-chat-hooks/oauth';
import type {
  ToolsetAuthFormData,
  ToolsetOAuthLoginHandler,
  ToolsetOAuthLoginResult,
} from '@epam/ai-dial-toolset-editor';
import { ToolsetOAuthLoginStatus } from '@epam/ai-dial-toolset-editor';
import { useCallback } from 'react';
import { ROUTES } from '../../types/routes';
import { fetchToolsetAuthSettings } from '../../utils/toolsets';

/**
 * Waits for an already-started authorization to settle and translates the
 * transport-level outcome into the editor's five statuses.
 */
const settleInitiation = async (
  initiation: ToolsetOAuthInitiationResult,
  toolsetId: string,
): Promise<ToolsetOAuthLoginResult> => {
  if (initiation.type === ToolsetOAuthInitiationResultType.Blocked) {
    return { status: ToolsetOAuthLoginStatus.PopupBlocked };
  }
  if (initiation.type !== ToolsetOAuthInitiationResultType.Started) {
    /*
     * The authorize URL could not be built from a known-good client — e.g.
     * Core's dynamic client registration returned no usable
     * clientId/authorizationEndpoint.
     */
    return { status: ToolsetOAuthLoginStatus.InvalidConfig };
  }

  const result = await waitForToolsetOAuthResult(
    initiation.popup,
    initiation.flowId,
    {
      toolsetId,
      credentialsLevel: ToolsetCredentialsLevel.User,
      callbackPath: ROUTES.ToolsetSignIn,
    },
  );

  if (result.type === ToolsetOAuthResultType.Success) {
    return { status: ToolsetOAuthLoginStatus.Success };
  }
  if (result.type === ToolsetOAuthResultType.Failure) {
    return { status: ToolsetOAuthLoginStatus.Failed };
  }

  /*
   * Treat the backend as the final authority if popup tracking or
   * cross-process message delivery ever still reports a false cancel. This
   * keeps the editor from showing "logged out" after a login that actually
   * completed server-side.
   */
  try {
    const refreshedAuth = await fetchToolsetAuthSettings(toolsetId);
    if (refreshedAuth.isLoggedIn) {
      return { status: ToolsetOAuthLoginStatus.Success };
    }
  } catch {
    // Best-effort verification only — a genuine cancel stays silent.
  }
  return { status: ToolsetOAuthLoginStatus.Cancelled };
};

/**
 * Owns the toolset editor's OAuth login flow on the application side: the
 * popup, the callback route it returns through, the credentials level, and
 * the backend reads the flow needs. `@epam/ai-dial-toolset-editor` receives
 * only the settled outcome, so the library stays unaware of every one of
 * those host concerns.
 */
export const useToolsetEditorOAuthLogin = (): ToolsetOAuthLoginHandler =>
  useCallback(async ({ auth, ensureSaved }) => {
    /*
     * "With Login" and no client id yet means this OAuth client relies on
     * Core's dynamic client registration (RFC 7591), which only assigns
     * `clientId`/`authorizationEndpoint` once the toolset is created — the
     * pre-save form state never carries them. The popup is opened
     * synchronously, before the persist/fetch awaits, so it stays a
     * user-triggered popup rather than one browsers block as programmatic.
     */
    const needsDynamicRegistration =
      auth.withLogin === WithLogin.WithLogin && !auth.clientId?.trim();

    if (needsDynamicRegistration) {
      const popup = openToolsetOAuthPopup();
      if (!popup) return { status: ToolsetOAuthLoginStatus.PopupBlocked };

      const savedToolsetId = await ensureSaved();
      if (!savedToolsetId) {
        popup.close();
        return { status: ToolsetOAuthLoginStatus.Cancelled };
      }

      let resolvedAuth: ToolsetAuthFormData;
      try {
        resolvedAuth = await fetchToolsetAuthSettings(savedToolsetId);
      } catch (error) {
        popup.close();
        const { traceId } = await getApiErrorDetails(error);
        return { status: ToolsetOAuthLoginStatus.Failed, traceId };
      }

      const settled = await settleInitiation(
        navigateToolsetOAuthPopup(
          popup,
          resolvedAuth,
          savedToolsetId,
          ROUTES.ToolsetSignIn,
          ToolsetCredentialsLevel.User,
        ),
        savedToolsetId,
      );
      /*
       * Registration assigned the client fields, so they are reported back
       * whatever the outcome — the editor shows them even if authorizing
       * then failed.
       */
      return { ...settled, auth: resolvedAuth };
    }

    const savedToolsetId = await ensureSaved();
    if (!savedToolsetId) return { status: ToolsetOAuthLoginStatus.Cancelled };

    return settleInitiation(
      initiateOAuthLogin(auth, savedToolsetId, ROUTES.ToolsetSignIn),
      savedToolsetId,
    );
  }, []);

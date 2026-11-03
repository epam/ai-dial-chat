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
  ToolsetOAuthLoginRequest,
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

/** Popup reserved and the toolset saved, with the auth settings Core stored. */
interface StoredAuthPopup {
  popup: Window;
  toolsetId: string;
  storedAuth: ToolsetAuthFormData;
}

/**
 * Opens the popup while the click still counts as a user gesture, persists
 * the toolset, then reads the auth settings Core stored — including what it
 * assigned during the save. Resolves the editor's outcome instead when any
 * step stops the flow.
 */
const openPopupWithStoredAuth = async (
  ensureSaved: ToolsetOAuthLoginRequest['ensureSaved'],
): Promise<StoredAuthPopup | ToolsetOAuthLoginResult> => {
  const popup = openToolsetOAuthPopup();
  if (!popup) return { status: ToolsetOAuthLoginStatus.PopupBlocked };

  const toolsetId = await ensureSaved();
  if (!toolsetId) {
    popup.close();
    return { status: ToolsetOAuthLoginStatus.Cancelled };
  }

  try {
    return {
      popup,
      toolsetId,
      storedAuth: await fetchToolsetAuthSettings(toolsetId),
    };
  } catch (error) {
    popup.close();
    const { traceId } = await getApiErrorDetails(error);
    return { status: ToolsetOAuthLoginStatus.Failed, traceId };
  }
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
     * pre-save form state never carries them.
     */
    const needsDynamicRegistration =
      auth.withLogin === WithLogin.WithLogin && !auth.clientId?.trim();

    if (needsDynamicRegistration) {
      const prepared = await openPopupWithStoredAuth(ensureSaved);
      if ('status' in prepared) return prepared;
      const { popup, toolsetId, storedAuth } = prepared;

      const settled = await settleInitiation(
        navigateToolsetOAuthPopup(
          popup,
          storedAuth,
          toolsetId,
          ROUTES.ToolsetSignIn,
          ToolsetCredentialsLevel.User,
        ),
        toolsetId,
      );
      /*
       * Registration assigned the client fields, so they are reported back
       * whatever the outcome — the editor shows them even if authorizing
       * then failed.
       */
      return { ...settled, auth: storedAuth };
    }

    /*
     * A static client saved without a resource may get one from the MCP
     * server's Protected Resource Metadata during the save. Core sends that
     * value on the token exchange, so the authorize URL has to carry it too
     * or a server enforcing RFC 8707 rejects the exchange.
     */
    if (auth.withLogin === WithLogin.WithConfig && !auth.resource?.trim()) {
      const prepared = await openPopupWithStoredAuth(ensureSaved);
      if ('status' in prepared) return prepared;
      const { popup, toolsetId, storedAuth } = prepared;

      const settled = await settleInitiation(
        navigateToolsetOAuthPopup(
          popup,
          { ...auth, resource: storedAuth.resource },
          toolsetId,
          ROUTES.ToolsetSignIn,
          ToolsetCredentialsLevel.User,
        ),
        toolsetId,
      );
      // Only the resource: the rest of the stored settings lack the typed secret.
      return { ...settled, auth: { resource: storedAuth.resource } };
    }

    const savedToolsetId = await ensureSaved();
    if (!savedToolsetId) return { status: ToolsetOAuthLoginStatus.Cancelled };

    return settleInitiation(
      initiateOAuthLogin(auth, savedToolsetId, ROUTES.ToolsetSignIn),
      savedToolsetId,
    );
  }, []);

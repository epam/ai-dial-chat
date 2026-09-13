import type { ToolsetAuthFormData } from './toolset-form';

/**
 * Outcome of the host's OAuth login flow, as this library understands it.
 *
 * The library never learns *how* the host logged the user in — popups,
 * redirect coordination, channels, storage, callback routes and credential
 * levels all stay on the host side. It only needs to know which of these
 * five things happened so it can pick the right notification and update the
 * form.
 */
export enum ToolsetOAuthLoginStatus {
  /** The user is logged in; the form switches to its logged-in state. */
  Success = 'success',
  /**
   * The user (or the host) abandoned the flow — a closed popup, an
   * abandoned save. Deliberately silent: nothing failed.
   */
  Cancelled = 'cancelled',
  /** The browser blocked the login popup before the flow could start. */
  PopupBlocked = 'popup-blocked',
  /** The provider returned no usable client configuration to authorize against. */
  InvalidConfig = 'invalid-config',
  /** The flow started but did not produce a session. */
  Failed = 'failed',
}

/** What the host reports back once its OAuth login flow settles. */
export interface ToolsetOAuthLoginResult {
  /** Which of the five outcomes the flow reached. */
  status: ToolsetOAuthLoginStatus;
  /**
   * Auth fields the host resolved while running the flow, merged into the
   * form before the status is applied. Dynamic client registration assigns
   * `clientId`/`authorizationEndpoint` only once the toolset exists, so the
   * host is the first to see them.
   */
  auth?: Partial<ToolsetAuthFormData>;
  /** Trace id of the failed request, shown alongside an error notification. */
  traceId?: string;
}

/** What this library hands the host when the user asks to log in with OAuth. */
export interface ToolsetOAuthLoginRequest {
  /** Current auth form state, including any unsaved edits. */
  auth: ToolsetAuthFormData;
  /**
   * Persists the form when it changed since the last save and resolves the
   * toolset id, or `false` when persisting failed or was abandoned. The host
   * must call this before authorizing: an unsaved toolset has no id to
   * attach credentials to.
   */
  ensureSaved: () => Promise<string | false>;
}

/**
 * Runs the host's OAuth login flow.
 *
 * Invoked synchronously from the user's click, before any `await`, so the
 * host can open a popup inside the user gesture — browsers block one opened
 * after the first suspension point.
 */
export type ToolsetOAuthLoginHandler = (
  request: ToolsetOAuthLoginRequest,
) => Promise<ToolsetOAuthLoginResult>;

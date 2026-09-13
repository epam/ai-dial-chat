/** A DIAL Core client-channel RPC request event, as framed on the `subscribe` SSE stream. */
export interface ClientChannelRpcRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

/** Method name for a mid-completion toolset sign-in interrupt. */
export const TOOLSET_SIGNIN_METHOD = 'toolset/signin';

/** Method name for a mid-completion application external-service sign-in interrupt. */
export const EXTERNAL_SERVICE_SIGNIN_METHOD = 'external-service/signin';

export enum PendingSigninEventKind {
  Toolset = 'toolset',
  ExternalService = 'external-service',
}

/** A pending `toolset/signin` event awaiting a login/decline resolution. */
export interface PendingToolsetSigninEvent {
  kind: PendingSigninEventKind.Toolset;
  /** RPC correlation id — every login/decline action resolves exactly this id. */
  id: string;
  toolsetId: string;
}

/**
 * A pending `external-service/signin` event awaiting a login/decline
 * resolution. The underlying RPC event's `params.url` is shaped
 * `applications/{bucket}/{app}/external_services/{name}` (parsed by
 * `parseExternalServiceUrl`): `appId` is the application's own resource id
 * (used to fetch its details for display metadata), `serviceName` keys the
 * application's `external_services` map for this specific dependency's
 * `displayName`/`authSettings`, and is also required (rejoined with `appId`
 * via `buildExternalServiceScopeId`) as the exact scope id DIAL Core expects
 * for sign-in/sign-out.
 */
export interface PendingExternalServiceSigninEvent {
  kind: PendingSigninEventKind.ExternalService;
  /** RPC correlation id — every login/decline action resolves exactly this id. */
  id: string;
  appId: string;
  serviceName: string;
}

export type PendingSigninEvent =
  | PendingToolsetSigninEvent
  | PendingExternalServiceSigninEvent;

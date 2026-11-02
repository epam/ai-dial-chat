/** A DIAL Core client-channel RPC request event, as framed on the `subscribe` SSE stream. */
export interface ClientChannelRpcRequest {
  /** RPC correlation id the host answers with. */
  id: string;
  /** RPC method name, e.g. `TOOLSET_SIGNIN_METHOD`. */
  method: string;
  /** Method-specific parameters. */
  params?: Record<string, unknown>;
}

/** Method name for a mid-completion toolset sign-in interrupt. */
export const TOOLSET_SIGNIN_METHOD = 'toolset/signin';

/** Method name for a mid-completion application external-service sign-in interrupt. */
export const EXTERNAL_SERVICE_SIGNIN_METHOD = 'external-service/signin';

/** Kind of sign-in a pending client-channel event asks for. */
export enum PendingSigninEventKind {
  /** A `toolset/signin` request. */
  Toolset = 'toolset',
  /** An `external-service/signin` request. */
  ExternalService = 'external-service',
}

/** A pending `toolset/signin` event awaiting a login/decline resolution. */
export interface PendingToolsetSigninEvent {
  /** Discriminant. */
  kind: PendingSigninEventKind.Toolset;
  /** RPC correlation id — every login/decline action resolves exactly this id. */
  id: string;
  /** Id of the toolset to sign in to. */
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
  /** Discriminant. */
  kind: PendingSigninEventKind.ExternalService;
  /** RPC correlation id — every login/decline action resolves exactly this id. */
  id: string;
  /** Resource id of the application that depends on the service. */
  appId: string;
  /** Key of the service in the application's `external_services` map. */
  serviceName: string;
}

/** A pending sign-in event of either kind. */
export type PendingSigninEvent =
  PendingToolsetSigninEvent | PendingExternalServiceSigninEvent;

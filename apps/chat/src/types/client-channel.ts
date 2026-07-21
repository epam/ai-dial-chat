/** A DIAL Core client-channel RPC request event, as framed on the `subscribe` SSE stream. */
export interface ClientChannelRpcRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

/** Method name for a mid-completion toolset sign-in interrupt. */
export const TOOLSET_SIGNIN_METHOD = 'toolset/signin';

/** A pending `toolset/signin` event awaiting a login/decline resolution. */
export interface PendingSigninEvent {
  /** RPC correlation id — every login/decline action resolves exactly this id. */
  id: string;
  toolsetId: string;
}

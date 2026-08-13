import type { components, operations } from '@epam/ai-dial-typescript-sdk';
import type {
  GetOfflineCredentialsResponseDto,
  OfflineCredentialsSigninBodyDto,
} from './dto/offline-credentials.dto';

type DialOfflineCredentialsStatus =
  components['schemas']['OfflineCredentialsStatus'];
type DialOfflineCredentialsSignInRequest =
  operations['offlineCredentialsSignIn']['requestBody']['content']['application/json'];

export const mapDialOfflineCredentialsToDto = (
  data: DialOfflineCredentialsStatus,
): GetOfflineCredentialsResponseDto => {
  const available = data.available ?? false;
  const connected = data.connected ?? false;
  const connect = data.connect;

  /*
   * `redirect_uri` is intentionally not required here: the OAuth popup flow
   * never uses Core's echoed value — it always builds its own redirect URI
   * from `window.location.origin` + the app's fixed callback route (mirrors
   * the toolset OAuth flow, see `useOfflineCredentialsLogin.ts`), so Core
   * omitting it must not invalidate an otherwise-usable `connect`.
   */
  if (
    !connect ||
    connect.authorization_endpoint == null ||
    connect.client_id == null
  ) {
    return { available, connected };
  }

  return {
    available,
    connected,
    connect: {
      authorizationEndpoint: connect.authorization_endpoint,
      clientId: connect.client_id,
      ...(connect.redirect_uri != null && {
        redirectUri: connect.redirect_uri,
      }),
      scopes: connect.scopes ?? [],
    },
  };
};

export const toDialOfflineCredentialsSigninBody = (
  body: OfflineCredentialsSigninBodyDto,
): DialOfflineCredentialsSignInRequest => ({
  code: body.code,
  redirectUri: body.redirectUri,
});

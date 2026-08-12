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

  if (
    !connect ||
    connect.authorization_endpoint == null ||
    connect.client_id == null ||
    connect.redirect_uri == null
  ) {
    return { available, connected };
  }

  return {
    available,
    connected,
    connect: {
      authorizationEndpoint: connect.authorization_endpoint,
      clientId: connect.client_id,
      redirectUri: connect.redirect_uri,
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

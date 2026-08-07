export enum AuthErrorCode {
  HeaderTokenExpired = 'AUTH_HEADER_TOKEN_EXPIRED',
  HeaderTokenInvalid = 'AUTH_HEADER_TOKEN_INVALID',
  HeaderTokenUntrustedIssuer = 'AUTH_HEADER_TOKEN_UNTRUSTED_ISSUER',
  HeaderMalformed = 'AUTH_HEADER_MALFORMED',
  NoCredentials = 'AUTH_NO_CREDENTIALS',
}

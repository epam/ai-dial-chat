/** Auth-type discriminant shared by both event kinds — mirrors the string-identical `ToolsetAuthTypes`/`ExternalServiceAuthType` enums. */
export enum RowAuthType {
  None = 'NONE',
  ApiKey = 'API_KEY',
  OAuth = 'OAUTH',
}

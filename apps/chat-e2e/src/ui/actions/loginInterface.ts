export interface LoginInterface {
  loginToChatBot(
    username: string,
    options?: { setEntitiesEnvVars: boolean },
  ): Promise<Map<string, string>>;
}

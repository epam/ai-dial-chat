import { BaseElement } from '@/src/ui/webElements';

export interface LoginInterface {
  loginToChatBot(
    username: string,
    password: string,
    options?: { setEntitiesEnvVars: boolean },
  ): Promise<Map<string, string>>;

  getLoginForm(): BaseElement;
}

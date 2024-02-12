import { BasePage } from './basePage';

import { Auth0 } from '@/src/ui/webElements/auth0';

export class Auth0Page extends BasePage {
  private auth0!: Auth0;

  getAuth0(): Auth0 {
    if (!this.auth0) {
      this.auth0 = new Auth0(this.page);
    }
    return this.auth0;
  }

  async loginToChatBot(
    username: string,
    options?: { setEntitiesEnvVars: boolean },
  ) {
    await this.page.waitForLoadState();
    await this.page.waitForLoadState('domcontentloaded');
    const auth0Form = this.getAuth0();
    await auth0Form.setCredentials(username, process.env.E2E_PASSWORD!);
    return this.waitFoApiResponsesReceived(
      () => auth0Form.loginButton.click(),
      options,
    );
  }
}

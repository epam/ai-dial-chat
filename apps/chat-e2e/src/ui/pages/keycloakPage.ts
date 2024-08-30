import { BasePage } from './basePage';

import { LoginInterface } from '@/src/ui/actions/loginInterface';
import { Keycloak } from '@/src/ui/webElements/keycloak';

export class KeycloakPage extends BasePage implements LoginInterface {
  public keycloak!: Keycloak;

  getKeycloak(): Keycloak {
    if (!this.keycloak) {
      this.keycloak = new Keycloak(this.page);
    }
    return this.keycloak;
  }

  async loginToChatBot(
    username: string,
    password: string,
    options?: { setEntitiesEnvVars: boolean },
  ) {
    await this.page.waitForLoadState();
    await this.page.waitForLoadState('domcontentloaded');
    const keycloak = this.getKeycloak();
    await keycloak.setCredentials(username, password);
    return this.waitForApiResponsesReceived(
      () => keycloak.signInButton.click(),
      options,
    );
  }
}

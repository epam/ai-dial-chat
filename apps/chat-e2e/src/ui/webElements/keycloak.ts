import { KeycloakSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class Keycloak extends BaseElement {
  constructor(page: Page) {
    super(page, KeycloakSelectors.keycloakContainer);
  }

  public emailInput = this.getChildElementBySelector(KeycloakSelectors.email);
  public passwordInput = this.getChildElementBySelector(
    KeycloakSelectors.password,
  );
  public signInButton = this.getChildElementBySelector(
    KeycloakSelectors.signiInButton,
  );

  public async setCredentials(email: string, password: string) {
    await this.emailInput.fillInInput(email);
    await this.passwordInput.waitForState();
    await this.passwordInput.fillInInput(password);
  }
}

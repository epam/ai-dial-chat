import { Auth0Selectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class Auth0 extends BaseElement {
  constructor(page: Page) {
    super(page, Auth0Selectors.auth0Container);
  }

  public usernameInput = this.getChildElementBySelector(
    Auth0Selectors.username,
  );
  public passwordInput = this.getChildElementBySelector(
    Auth0Selectors.password,
  );
  public loginButton = this.getChildElementBySelector(Auth0Selectors.login);

  public async setCredentials(username: string, password: string) {
    await this.usernameInput.fillInInput(username);
    await this.passwordInput.fillInInput(password);
  }
}

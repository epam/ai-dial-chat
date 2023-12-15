import { LoginSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class Auth0 extends BaseElement {
  constructor(page: Page) {
    super(page, LoginSelectors.auth0Container);
  }

  public usernameInput = this.getChildElementBySelector(
    LoginSelectors.username,
  );
  public passwordInput = this.getChildElementBySelector(
    LoginSelectors.password,
  );
  public loginButton = this.getChildElementBySelector(LoginSelectors.login);

  public async setCredentials(username: string, password: string) {
    await this.usernameInput.fillInInput(username);
    await this.passwordInput.fillInInput(password);
  }
}

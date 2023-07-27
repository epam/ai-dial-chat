import { BasePage } from '../pages/basePage';

import { LoginSelectors } from '../selectors/loginSelectors';
import { BaseElement } from '../webElements/baseElement';

export class LoginPage extends BasePage {
  private tokenInput = new BaseElement(this.page, LoginSelectors.token);
  private signInButton = new BaseElement(this.page, LoginSelectors.signIn)
    .getRootLocator()
    .getByText('Sign in with Credentials');

  async loginToChatBot() {
    await this.tokenInput.typeInInput(process.env.USER_TOKEN!);
    await this.signInButton.click();
  }
}

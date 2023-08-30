import { ExpectedConstants } from '../../testData';
import { LoginSelectors } from '../selectors';
import { BaseElement } from '../webElements';
import { BasePage } from './basePage';

export class LoginPage extends BasePage {
  private tokenInput = new BaseElement(this.page, LoginSelectors.token);
  private signInButton = new BaseElement(
    this.page,
    LoginSelectors.signIn,
  ).getElementLocatorByText(ExpectedConstants.signInButtonTitle);

  async loginToChatBot() {
    console.log('Auth: ' + process.env.AUTH_TEST_TOKEN!.length);
    await this.tokenInput.typeInInput(
      process.env.AUTH_TEST_TOKEN!.split(',')[0],
    );
    await this.signInButton.click();
  }
}

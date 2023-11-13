import { ExpectedConstants } from '../../testData';
import { LoginSelectors } from '../selectors';
import { BaseElement } from '../webElements';
import { BasePage } from './basePage';

import * as process from 'process';

export class LoginPage extends BasePage {
  private tokenInput = new BaseElement(this.page, LoginSelectors.token);
  private signInButton = new BaseElement(
    this.page,
    LoginSelectors.signIn,
  ).getElementLocatorByText(ExpectedConstants.signInButtonTitle);

  async loginToChatBot() {
    const token = process.env.PREVIEW_TEST_TOKEN
      ? process.env.PREVIEW_TEST_TOKEN!.split(',')[0]
      : process.env.AUTH_TEST_TOKEN!.split(',')[0];
    await this.tokenInput.typeInInput(token);
    return this.waitFoApiResponsesReceived(() => this.signInButton.click(), {
      setEntitiesEnvVars: true,
    });
  }
}

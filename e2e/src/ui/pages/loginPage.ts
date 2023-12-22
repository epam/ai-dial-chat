import { BaseElement } from '../webElements';
import { BasePage } from './basePage';

import { LoginSelectors } from '@/e2e/src/ui/selectors';

export class LoginPage extends BasePage {
  public ssoSignInButton = new BaseElement(this.page, LoginSelectors.ssoSignIn);
}

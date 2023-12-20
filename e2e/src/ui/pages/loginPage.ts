import { BaseElement } from '../webElements';
import { BasePage } from './basePage';

import { Tags } from '@/e2e/src/ui/domData';

export class LoginPage extends BasePage {
  public ssoSignInButton = new BaseElement(
    this.page,
    `${Tags.button}.${Tags.button}`,
  );
}

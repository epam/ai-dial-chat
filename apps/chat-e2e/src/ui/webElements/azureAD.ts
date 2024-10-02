import { AzureADSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class AzureAD extends BaseElement {
  constructor(page: Page) {
    super(page, AzureADSelectors.azureADContainer);
  }

  public emailInput = this.getChildElementBySelector(AzureADSelectors.email);
  public passwordInput = this.getChildElementBySelector(
    AzureADSelectors.password,
  );
  public nextButton = this.getChildElementBySelector(
    AzureADSelectors.nextButton,
  );
  public signInButton = this.getChildElementBySelector(
    AzureADSelectors.signiInButton,
  );

  public async setCredentials(email: string, password: string) {
    await this.emailInput.fillInInput(email);
    await this.nextButton.click();
    await this.passwordInput.waitForState();
    await this.passwordInput.fillInInput(password);
  }
}

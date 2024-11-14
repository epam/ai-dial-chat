import { BasePage } from './basePage';

import { LoginInterface } from '@/src/ui/actions/loginInterface';
import { AzureAD } from '@/src/ui/webElements/azureAD';

export class AzureADPage extends BasePage implements LoginInterface {
  public azureAD!: AzureAD;

  getAzureAD(): AzureAD {
    if (!this.azureAD) {
      this.azureAD = new AzureAD(this.page);
    }
    return this.azureAD;
  }

  async loginToChatBot(
    username: string,
    password: string,
    options?: { setEntitiesEnvVars: boolean },
  ) {
    await this.page.waitForLoadState();
    await this.page.waitForLoadState('domcontentloaded');
    const azureAD = this.getAzureAD();
    await azureAD.setCredentials(username, password);
    return this.waitForApiResponsesReceived(
      () => azureAD.signInButton.click(),
      options,
    );
  }
}

import { LocalStorageManager } from '@/src/core/localStorageManager';
import { ProviderLogin } from '@/src/ui/actions/providerLogin';
import { AzureADPage } from '@/src/ui/pages/azureADPage';
import { LoginPage } from '@/src/ui/pages/loginPage';
import { BaseElement } from '@/src/ui/webElements';

export class AzureADLogin extends ProviderLogin<AzureADPage> {
  constructor(
    loginPage: LoginPage,
    authProviderPage: AzureADPage,
    localStorageManager: LocalStorageManager,
  ) {
    super(loginPage, authProviderPage, localStorageManager);
  }

  getSignInButton(): BaseElement {
    return this.loginPage.keycloakSignInButton;
  }
}

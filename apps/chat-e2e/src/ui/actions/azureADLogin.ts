import { LocalStorageManager } from '@/src/core/localStorageManager';
import { ProviderLogin } from '@/src/ui/actions/providerLogin';
import { AzureADPage } from '@/src/ui/pages/azureADPage';
import { LoginPage } from '@/src/ui/pages/loginPage';

export class AzureADLogin extends ProviderLogin<AzureADPage> {
  constructor(
    loginPage: LoginPage,
    authProviderPage: AzureADPage,
    localStorageManager: LocalStorageManager,
  ) {
    super(loginPage, authProviderPage, localStorageManager);
  }

  public async navigateToCredentialsPage() {
    await this.loginPage.keycloakSignInButton.click();
  }
}

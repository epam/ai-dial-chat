import { LocalStorageManager } from '@/src/core/localStorageManager';
import { ProviderLogin } from '@/src/ui/actions/providerLogin';
import { KeycloakPage } from '@/src/ui/pages';
import { LoginPage } from '@/src/ui/pages/loginPage';

export class KeycloakLogin extends ProviderLogin<KeycloakPage> {
  constructor(
    loginPage: LoginPage,
    authProviderPage: KeycloakPage,
    localStorageManager: LocalStorageManager,
  ) {
    super(loginPage, authProviderPage, localStorageManager);
  }

  public async navigateToCredentialsPage() {
    await this.loginPage.keycloakSignInButton.click();
  }
}

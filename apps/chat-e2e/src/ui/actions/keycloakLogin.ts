import { LocalStorageManager } from '@/src/core/localStorageManager';
import { ProviderLogin } from '@/src/ui/actions/providerLogin';
import { KeycloakPage } from '@/src/ui/pages/keycloakPage';
import { LoginPage } from '@/src/ui/pages/loginPage';
import { TestInfo } from '@playwright/test';

export class KeycloakLogin extends ProviderLogin<KeycloakPage> {
  constructor(
    loginPage: LoginPage,
    authProviderPage: KeycloakPage,
    localStorageManager: LocalStorageManager,
  ) {
    super(loginPage, authProviderPage, localStorageManager);
  }

  public async login(testInfo: TestInfo, username: string) {
    await this.loginPage.navigateToBaseUrl();
    await this.loginPage.keycloakSignInButton.click();
    return this.authProviderLogin(testInfo, username);
  }
}

import { LocalStorageManager } from '@/src/core/localStorageManager';
import { ProviderLogin } from '@/src/ui/actions/providerLogin';
import { Auth0Page } from '@/src/ui/pages/auth0Page';
import { LoginPage } from '@/src/ui/pages/loginPage';
import { TestInfo } from '@playwright/test';

export class Auth0Login extends ProviderLogin<Auth0Page> {
  constructor(
    loginPage: LoginPage,
    authProviderPage: Auth0Page,
    localStorageManager: LocalStorageManager,
  ) {
    super(loginPage, authProviderPage, localStorageManager);
  }

  public async login(testInfo: TestInfo, username: string) {
    await this.loginPage.navigateToBaseUrl();
    await this.loginPage.auth0SignInButton.click();
    return this.authProviderLogin(testInfo, username);
  }
}

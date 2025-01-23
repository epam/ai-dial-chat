import { LocalStorageManager } from '@/src/core/localStorageManager';
import { ProviderLogin } from '@/src/ui/actions/providerLogin';
import { Auth0Page } from '@/src/ui/pages/auth0Page';
import { LoginPage } from '@/src/ui/pages/loginPage';

export class Auth0Login extends ProviderLogin<Auth0Page> {
  constructor(
    loginPage: LoginPage,
    authProviderPage: Auth0Page,
    localStorageManager: LocalStorageManager,
  ) {
    super(loginPage, authProviderPage, localStorageManager);
  }

  public async navigateToCredentialsPage() {
    await this.loginPage.auth0SignInButton.click();
  }
}

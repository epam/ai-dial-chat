import { LocalStorageManager } from '@/src/core/localStorageManager';
import { AuthProvider } from '@/src/testData';
import { Auth0Login } from '@/src/ui/actions/auth0Login';
import { KeycloakLogin } from '@/src/ui/actions/keycloakLogin';
import { ProviderLogin } from '@/src/ui/actions/providerLogin';
import { LoginPage } from '@/src/ui/pages';
import { Auth0Page } from '@/src/ui/pages/auth0Page';
import { KeycloakPage } from '@/src/ui/pages/keycloakPage';
import { test as base } from '@playwright/test';
import * as process from 'node:process';

export const skipReason = 'Execute test on CI env only';

const test = base.extend<{
  loginPage: LoginPage;
  auth0Page: Auth0Page;
  keycloakPage: KeycloakPage;
  localStorageManager: LocalStorageManager;
  auth0Login: ProviderLogin<Auth0Page>;
  keycloakLogin: ProviderLogin<KeycloakPage>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providerLogin: ProviderLogin<any>;
}>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
  auth0Page: async ({ page }, use) => {
    const auth0Page = new Auth0Page(page);
    await use(auth0Page);
  },
  keycloakPage: async ({ page }, use) => {
    const keycloakPage = new KeycloakPage(page);
    await use(keycloakPage);
  },
  auth0Login: async ({ loginPage, auth0Page, localStorageManager }, use) => {
    const auth0Login = new Auth0Login(
      loginPage,
      auth0Page,
      localStorageManager,
    );
    await use(auth0Login);
  },
  keycloakLogin: async (
    { loginPage, keycloakPage, localStorageManager },
    use,
  ) => {
    const keycloakLogin = new KeycloakLogin(
      loginPage,
      keycloakPage,
      localStorageManager,
    );
    await use(keycloakLogin);
  },
  providerLogin: async ({ auth0Login, keycloakLogin }, use) => {
    let providerLogin;
    //AUTH_PROVIDER env var to define authentication provider
    //auth0 provider is used if AUTH_PROVIDER is undefined
    switch (process.env.AUTH_PROVIDER) {
      case AuthProvider.auth0:
        providerLogin = auth0Login;
        break;
      case AuthProvider.keycloak:
        providerLogin = keycloakLogin;
        break;
      //implement login action for other providers
      default:
        providerLogin = auth0Login;
    }
    await use(providerLogin);
  },
  localStorageManager: async ({ page }, use) => {
    const localStorageManager = new LocalStorageManager(page);
    await use(localStorageManager);
  },
});

export default test;

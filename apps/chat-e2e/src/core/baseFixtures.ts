import { BaseAssertion } from '@/src/assertions';
import { LocalStorageManager } from '@/src/core/localStorageManager';
import {
  AuthProvider,
  ConversationData,
  PromptData,
  PublishRequestBuilder,
} from '@/src/testData';
import { Auth0Login } from '@/src/ui/actions/auth0Login';
import { AzureADLogin } from '@/src/ui/actions/azureADLogin';
import { KeycloakLogin } from '@/src/ui/actions/keycloakLogin';
import { ProviderLogin } from '@/src/ui/actions/providerLogin';
import { KeycloakPage, LoginPage } from '@/src/ui/pages';
import { Auth0Page } from '@/src/ui/pages/auth0Page';
import { AzureADPage } from '@/src/ui/pages/azureADPage';
import { Page, test as base } from '@playwright/test';
import { allure } from 'allure-playwright';
import * as process from 'node:process';

export const skipReason = 'Execute test on CI env only';
export const noSimpleModelSkipReason =
  'Skip the test if no simple model is configured';
export const noImportModelsSkipReason =
  'Skip the test if imported models are not configured';

interface ReportAttributes {
  setTestIds: (...testId: string[]) => void;
  setIssueIds: (...issueIds: string[]) => void;
}

const test = base.extend<
  ReportAttributes & {
    loginPage: LoginPage;
    auth0Page: Auth0Page;
    azureADPage: AzureADPage;
    keycloakPage: KeycloakPage;
    localStorageManager: LocalStorageManager;
    auth0Login: ProviderLogin<Auth0Page>;
    azureADLogin: ProviderLogin<AzureADPage>;
    keycloakLogin: ProviderLogin<KeycloakPage>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    providerLogin: ProviderLogin<any>;
    incognitoPage: Page;
    incognitoLoginPage: LoginPage;
    incognitoAuth0Page: Auth0Page;
    incognitoLocalStorageManager: LocalStorageManager;
    incognitoAuth0Login: ProviderLogin<Auth0Page>;
    baseAssertion: BaseAssertion;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    incognitoProviderLogin: ProviderLogin<any>;
    conversationData: ConversationData;
    promptData: PromptData;
    publishRequestBuilder: PublishRequestBuilder;
  }
>({
  // eslint-disable-next-line no-empty-pattern
  setTestIds: async ({}, use) => {
    const callback = (...testIds: string[]) => {
      for (const testId of testIds) {
        allure.tms(testId, `${process.env.TMS_URL}/${testId}`);
      }
    };
    await use(callback);
  },
  // eslint-disable-next-line no-empty-pattern
  setIssueIds: async ({}, use) => {
    const callback = (...issueIds: string[]) => {
      for (const issueId of issueIds) {
        allure.issue(issueId, `${process.env.ISSUE_URL}/${issueId}`);
        test.skip();
      }
    };
    await use(callback);
  },
  // eslint-disable-next-line no-empty-pattern
  baseAssertion: async ({}, use) => {
    const baseAssertion = new BaseAssertion();
    await use(baseAssertion);
  },
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
  auth0Page: async ({ page }, use) => {
    const auth0Page = new Auth0Page(page);
    await use(auth0Page);
  },
  azureADPage: async ({ page }, use) => {
    const azureADPage = new AzureADPage(page);
    await use(azureADPage);
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
  azureADLogin: async (
    { loginPage, azureADPage, localStorageManager },
    use,
  ) => {
    const azureADLogin = new AzureADLogin(
      loginPage,
      azureADPage,
      localStorageManager,
    );
    await use(azureADLogin);
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
  providerLogin: async ({ auth0Login, azureADLogin, keycloakLogin }, use) => {
    let providerLogin;
    //AUTH_PROVIDER env var to define authentication provider
    //auth0 provider is used if AUTH_PROVIDER is undefined
    switch (process.env.AUTH_PROVIDER) {
      case AuthProvider.auth0:
        providerLogin = auth0Login;
        break;
      case AuthProvider.azureAD:
        providerLogin = azureADLogin;
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

  incognitoPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: undefined });
    const incognitoPage = await context.newPage();
    await use(incognitoPage);
    await context.close();
  },
  incognitoLoginPage: async ({ incognitoPage }, use) => {
    const incognitoLoginPage = new LoginPage(incognitoPage);
    await use(incognitoLoginPage);
  },
  incognitoAuth0Page: async ({ incognitoPage }, use) => {
    const incognitoAuth0Page = new Auth0Page(incognitoPage);
    await use(incognitoAuth0Page);
  },
  incognitoLocalStorageManager: async ({ incognitoPage }, use) => {
    const incognitoLocalStorageManager = new LocalStorageManager(incognitoPage);
    await use(incognitoLocalStorageManager);
  },
  incognitoAuth0Login: async (
    { incognitoLoginPage, incognitoAuth0Page, incognitoLocalStorageManager },
    use,
  ) => {
    const incognitoAuth0Login = new Auth0Login(
      incognitoLoginPage,
      incognitoAuth0Page,
      incognitoLocalStorageManager,
    );
    await use(incognitoAuth0Login);
  },
  incognitoProviderLogin: async ({ incognitoAuth0Login }, use) => {
    let incognitoProviderLogin;
    switch (process.env.AUTH_PROVIDER) {
      case AuthProvider.auth0:
        incognitoProviderLogin = incognitoAuth0Login;
        break;
      //implement login action for other providers
      default:
        incognitoProviderLogin = incognitoAuth0Login;
    }
    await use(incognitoProviderLogin);
  },
  // eslint-disable-next-line no-empty-pattern
  conversationData: async ({}, use) => {
    const conversationData = new ConversationData();
    await use(conversationData);
  },
  // eslint-disable-next-line no-empty-pattern
  promptData: async ({}, use) => {
    const promptData = new PromptData();
    await use(promptData);
  },
  // eslint-disable-next-line no-empty-pattern
  publishRequestBuilder: async ({}, use) => {
    const publishRequestBuilder = new PublishRequestBuilder();
    await use(publishRequestBuilder);
  },
});

export default test;

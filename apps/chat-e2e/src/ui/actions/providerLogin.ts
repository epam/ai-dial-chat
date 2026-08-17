import { LocalStorageManager } from '@/src/core/localStorageManager';
import { writeModelsFile } from '@/src/core/testPaths';
import { API } from '@/src/testData';
import { LoginInterface } from '@/src/ui/actions/loginInterface';
import { BasePage } from '@/src/ui/pages/basePage';
import { LoginPage } from '@/src/ui/pages/loginPage';
import { BaseElement } from '@/src/ui/webElements';
import { TestInfo } from '@playwright/test';

export abstract class ProviderLogin<T extends BasePage & LoginInterface> {
  public loginPage: LoginPage;
  public authProviderPage: T;
  public localStorageManager: LocalStorageManager;

  protected constructor(
    loginPage: LoginPage,
    authProviderPage: T,
    localStorageManager: LocalStorageManager,
  ) {
    this.loginPage = loginPage;
    this.authProviderPage = authProviderPage;
    this.localStorageManager = localStorageManager;
  }

  getAuthProviderPage(): T {
    return this.authProviderPage;
  }

  abstract getSignInButton(): BaseElement;

  async navigateToCredentialsPage(): Promise<void> {
    const signInButton = this.getSignInButton();
    if (await signInButton.isVisible()) {
      await signInButton.click();
    }
  }
  public async login(
    testInfo: TestInfo,
    username: string,
    password: string,
    setEntitiesEnvVars = true,
    url?: string,
  ): Promise<Map<string, string>> {
    await this.navigateToProviderStartPage(url);
    await this.navigateToCredentialsPage();
    return this.authProviderLogin(
      testInfo,
      username,
      password,
      setEntitiesEnvVars,
    );
  }

  protected async navigateToProviderStartPage(url?: string) {
    url
      ? await this.loginPage.navigateToUrl(url)
      : await this.loginPage.navigateToBaseUrl();
  }

  protected async authProviderLogin(
    testInfo: TestInfo,
    username: string,
    password: string,
    setEnvVars = true,
  ) {
    let options;
    if (setEnvVars && testInfo.parallelIndex == 0) {
      options = { setEntitiesEnvVars: true };
    }
    const retrievedResponses = await this.authProviderPage.loginToChatBot(
      username,
      password,
      options,
    );
    if (options?.setEntitiesEnvVars) {
      writeModelsFile(retrievedResponses.get(API.modelsHost) ?? '[]');
      process.env.THEMES = retrievedResponses.get(API.themesListingHost);
      process.env.APP_SCHEMAS = retrievedResponses.get(API.appSchemasHost);
      process.env.RECENT_MODELS =
        await this.localStorageManager.getRecentModels();
    }
    return retrievedResponses;
  }
}

import { LocalStorageManager } from '@/src/core/localStorageManager';
import { API } from '@/src/testData';
import { LoginInterface } from '@/src/ui/actions/loginInterface';
import { BasePage } from '@/src/ui/pages/basePage';
import { LoginPage } from '@/src/ui/pages/loginPage';
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

  abstract login(
    testInfo: TestInfo,
    username: string,
  ): Promise<Map<string, string>>;

  protected async authProviderLogin(testInfo: TestInfo, username: string) {
    let options;
    if (testInfo.parallelIndex == 0) {
      options = { setEntitiesEnvVars: true };
    }
    const retrievedResponses = await this.authProviderPage.loginToChatBot(
      username,
      options,
    );
    if (options?.setEntitiesEnvVars) {
      process.env.MODELS = retrievedResponses.get(API.modelsHost);
      process.env.ADDONS = retrievedResponses.get(API.addonsHost);
      process.env.RECENT_ADDONS =
        await this.localStorageManager.getRecentAddons();
      process.env.RECENT_MODELS =
        await this.localStorageManager.getRecentModels();
    }
    return retrievedResponses;
  }
}

import { API } from '@/src/testData';
import { Tags } from '@/src/ui/domData';
import { IconSelectors, ToolsetLoginModalSelectors } from '@/src/ui/selectors';
import { Button } from '@/src/ui/webElements';
import { Popup } from '@/src/ui/webElements/common/popup';
import { FieldLabel } from '@/src/ui/webElements/fieldLabel';
import { Toolset } from '@epam/ai-dial-shared';
import { Page } from '@playwright/test';

export class ToolsetLoginModal extends Popup {
  constructor(page: Page) {
    super(page, ToolsetLoginModalSelectors.modalContainer);
  }

  public header = this.getChildElementBySelector(
    ToolsetLoginModalSelectors.header,
  );
  public toolsetName = this.getChildElementBySelector(
    ToolsetLoginModalSelectors.toolsetName,
  );
  public toolsetVersion = this.getChildElementBySelector(
    ToolsetLoginModalSelectors.toolsetVersion,
  );
  public toolsetDefaultIcon = this.getChildElementBySelector(
    IconSelectors.defaultToolsetIcon,
  );
  public apiKeyFieldContainer = this.getChildElementBySelector(
    ToolsetLoginModalSelectors.apiKeyFieldContainer,
  );
  public apiKeyFieldHelpIcon =
    this.apiKeyFieldContainer.getChildElementBySelector(IconSelectors.helpIcon);
  public apiKeyMaskedFieldInput =
    this.apiKeyFieldContainer.getChildElementBySelector(
      ToolsetLoginModalSelectors.apiKeyMaskedFieldInput,
    );
  public apiKeyUnmaskedFieldInput =
    this.apiKeyFieldContainer.getChildElementBySelector(
      ToolsetLoginModalSelectors.apiKeyUnmaskedFieldInput,
    );
  public apiKeyFieldMaskedIcon =
    this.apiKeyFieldContainer.getChildElementBySelector(
      IconSelectors.eyeOffIcon,
    );
  public apiKeyFieldUnmaskedIcon =
    this.apiKeyFieldContainer.getChildElementBySelector(IconSelectors.eyeIcon);
  public loginButton = new Button(
    this.page,
    ToolsetLoginModalSelectors.loginButton,
    this.rootLocator,
  );
  public apiKeyFieldLabel = new FieldLabel(this.page, this.rootLocator);
  public manageCredsHeader = this.getChildElementBySelector(
    ToolsetLoginModalSelectors.manageCredsHeader,
  );
  public orgCredsAccordion = this.getChildElementBySelector(
    ToolsetLoginModalSelectors.orgCredsAccordion,
  );
  public orgCredsContent = this.getChildElementBySelector(
    ToolsetLoginModalSelectors.orgCredsContent,
  );
  public orgCredsApiKeyInput = this.orgCredsContent.getChildElementBySelector(
    ToolsetLoginModalSelectors.apiKeyMaskedFieldInput,
  );
  public orgCredsLoginButton = new Button(
    this.page,
    ToolsetLoginModalSelectors.loginButton,
    this.orgCredsContent.getElementLocator(),
  );
  public orgCredsLogoutButton = new Button(
    this.page,
    ToolsetLoginModalSelectors.logoutButton,
    this.orgCredsContent.getElementLocator(),
  );
  public myCredsAccordion = this.getChildElementBySelector(
    ToolsetLoginModalSelectors.myCredsAccordion,
  );
  public myCredsContent = this.getChildElementBySelector(
    ToolsetLoginModalSelectors.myCredsContent,
  );
  public myCredsText = this.myCredsContent.getChildElementBySelector(Tags.p);
  public myCredsApiKeyInput = this.myCredsContent.getChildElementBySelector(
    ToolsetLoginModalSelectors.apiKeyMaskedFieldInput,
  );
  public myCredsLoginButton = new Button(
    this.page,
    ToolsetLoginModalSelectors.loginButton,
    this.myCredsContent.getElementLocator(),
  );
  public myCredsLogoutButton = new Button(
    this.page,
    ToolsetLoginModalSelectors.logoutButton,
    this.myCredsContent.getElementLocator(),
  );
  public orgCredsText = this.orgCredsContent.getChildElementBySelector(Tags.p);

  async clickOrgCredsLoginButtonForOAuth(): Promise<Page> {
    return this.clickLoginButtonForOAuth(() =>
      this.orgCredsLoginButton.click(),
    );
  }

  async clickMyCredsLoginButtonForOAuth(): Promise<Page> {
    return this.clickLoginButtonForOAuth(() => this.myCredsLoginButton.click());
  }

  async clickPublicToolsetLoginForOAuth(): Promise<Page> {
    return this.clickLoginButtonForOAuth(() => this.loginButton.click());
  }

  async clickOrgCredsLoginButtonForApiKey() {
    return this.clickLoginButtonForApiKey(() =>
      this.orgCredsLoginButton.click(),
    );
  }

  async clickPublicToolsetLoginForApiKey() {
    return this.clickLoginButtonForApiKey(() => this.loginButton.click());
  }

  async clickMyCredsLoginButtonForApiKey() {
    return this.clickLoginButtonForApiKey(() =>
      this.myCredsLoginButton.click(),
    );
  }

  private async clickLoginButtonForOAuth(
    method: () => Promise<void>,
  ): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await method();
    const popup = await popupPromise;
    try {
      await popup.waitForLoadState('domcontentloaded');
    } catch {
      // popup may close before DOM loads if the flow finishes very fast
    }
    return popup;
  }

  private async clickLoginButtonForApiKey(method: () => Promise<void>) {
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes(API.toolsetCreateHost()) && r.status() === 200,
    );
    await method();
    const response = await responsePromise;
    return (await response.json()) as Toolset;
  }
}

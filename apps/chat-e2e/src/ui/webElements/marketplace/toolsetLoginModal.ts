import { Tags } from '@/src/ui/domData';
import { IconSelectors, ToolsetLoginModalSelectors } from '@/src/ui/selectors';
import { Button } from '@/src/ui/webElements';
import { Popup } from '@/src/ui/webElements/common/popup';
import { FieldLabel } from '@/src/ui/webElements/fieldLabel';
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
  public orgCredsText = this.orgCredsContent.getChildElementBySelector(Tags.p);

  async clickOrgCredsLoginButtonForOAuth(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.orgCredsLoginButton.click();
    const popup = await popupPromise;
    try {
      await popup.waitForLoadState('domcontentloaded');
    } catch {
      // popup may close before DOM loads if the flow finishes very fast
    }
    return popup;
  }

  async clickMyCredsLoginButtonForOAuth(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.myCredsLoginButton.click();
    const popup = await popupPromise;
    try {
      await popup.waitForLoadState('domcontentloaded');
    } catch {
      // popup may close before DOM loads if the flow finishes very fast
    }
    return popup;
  }
}

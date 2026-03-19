import { OAuthOptions } from '@/src/testData';
import { AttributeValues, Attributes } from '@/src/ui/domData';
import {
  AddToolsetSettingsFormSelector,
  IconSelectors,
} from '@/src/ui/selectors';
import { Button, Combobox, EntityEditorViewForm } from '@/src/ui/webElements';
import { Page } from '@playwright/test';

export class ToolsetEditorViewForm extends EntityEditorViewForm {
  public definitionLabel = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.definitionLabel,
  );
  public endpointLabel = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.endpointLabel,
  );
  public endpoint = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.endpoint,
  );
  public protocolLabel = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.protocolLabel,
  );
  public transportProtocol = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.transportProtocol,
  );
  public authenticationLabel = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.authenticationLabel,
  );
  public authenticationLabelSubtitle = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.authenticationLabelSubtitle,
  );
  public authContainer = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.authContainer,
  );
  public oauthContainer = this.authContainer.getChildElementBySelector(
    AddToolsetSettingsFormSelector.oauthContainer,
  );
  public oauthLabel = this.authContainer.getChildElementBySelector(
    AddToolsetSettingsFormSelector.oauthLabel,
  );
  public oauthIcon = this.authContainer.getChildElementBySelector(
    IconSelectors.oauthIcon,
  );
  public authDetailsContainer = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.authDetailsContainer,
  );
  public oAuthOptions = this.authDetailsContainer
    .getChildElementBySelector(AddToolsetSettingsFormSelector.authLoginOption)
    .getElementLocator()
    .filter({ has: this.page.getByRole('radio') });
  public oAuthOption = (loginOption: OAuthOptions) =>
    this.oAuthOptions.locator(`[${Attributes.id}="${loginOption}"]`);
  public loginButton = new Button(
    this.page,
    AttributeValues.login,
    this.rootLocator,
  );
  public logoutButton = new Button(
    this.page,
    AttributeValues.logout,
    this.rootLocator,
  );
  public apiKeyContainer = this.authContainer.getChildElementBySelector(
    AddToolsetSettingsFormSelector.apiKeyContainer,
  );
  public apiKeyLabel = this.authContainer.getChildElementBySelector(
    AddToolsetSettingsFormSelector.apiKeyLabel,
  );
  public apiKeyIcon = this.authContainer.getChildElementBySelector(
    IconSelectors.keyIcon,
  );
  public withoutAuthContainer = this.authContainer.getChildElementBySelector(
    AddToolsetSettingsFormSelector.withoutAuthContainer,
  );
  public withoutAuthLabel = this.authContainer.getChildElementBySelector(
    AddToolsetSettingsFormSelector.withoutAuthLabel,
  );
  public withoutAuthIcon = this.authContainer.getChildElementBySelector(
    IconSelectors.lockOffIcon,
  );
  public allowedToolsLabel = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.allowedToolsLabel,
  );
  public allowedToolsLabelSubtitle = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.allowedToolsLabelSubtitle,
  );
  public allowedTools = new Combobox(this.page, this.rootLocator);

  public async clickLoginButton(
    triggeredHttpHost?: string,
  ): Promise<Page | void> {
    return this.initAuthentication(this.loginButton, triggeredHttpHost);
  }

  public async clickLogoutButton(triggeredHttpHost?: string) {
    return this.initAuthentication(this.logoutButton, triggeredHttpHost);
  }

  // OAuth login now opens a popup instead of redirecting the main page.
  // The mock route redirects the popup to the callback URL (302).
  // We wait for the popup to load the callback page so the captured
  // OAuth state is available right after this method returns.
  public async initAuthentication(
    button: Button,
    triggeredHttpHost?: string,
  ): Promise<Page | void> {
    if (triggeredHttpHost) {
      const popupPromise = this.page.waitForEvent('popup');
      await button.click();
      const popup = await popupPromise;
      try {
        // popup is redirected to /auth/toolset-signin — wait for it to load
        await popup.waitForLoadState('domcontentloaded');
      } catch {
        // popup may close before DOM loads if the flow finishes very fast
      }
      return popup;
    }
    await button.click();
  }
}

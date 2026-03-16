import { OAuthOptions } from '@/src/testData';
import { AttributeValues, Attributes } from '@/src/ui/domData';
import {
  AddToolsetSettingsFormSelector,
  IconSelectors,
} from '@/src/ui/selectors';
import { Button, Combobox, EntityEditorViewForm } from '@/src/ui/webElements';

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

  public async clickLoginButton(triggeredHttpHost?: string) {
    return this.initAuthentication(this.loginButton, triggeredHttpHost);
  }

  public async clickLogoutButton(triggeredHttpHost?: string) {
    return this.initAuthentication(this.logoutButton, triggeredHttpHost);
  }

  public async initAuthentication(button: Button, triggeredHttpHost?: string) {
    if (triggeredHttpHost) {
      const eventPromise = this.page.waitForEvent('requestfailed', {
        predicate: (request) =>
          request.url().startsWith(triggeredHttpHost.toLowerCase()),
      });
      await button.click();
      return eventPromise;
    }
    await button.click();
  }
}

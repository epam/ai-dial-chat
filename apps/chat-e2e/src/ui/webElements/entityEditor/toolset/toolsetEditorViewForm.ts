import { OAuthOptions } from '@/src/testData';
import { AttributeValues, Attributes, Tags } from '@/src/ui/domData';
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
  public oAuthOptionRadioButton = (loginOption: OAuthOptions) =>
    this.oAuthOption(loginOption)
      .locator('~*')
      .locator(IconSelectors.circleIcon);
  public oAuthLoginForm = this.authDetailsContainer.getChildElementBySelector(
    AddToolsetSettingsFormSelector.authLoginForm,
  );
  public clientIdFieldContainer = this.oAuthLoginForm.getChildElementBySelector(
    AddToolsetSettingsFormSelector.clientIdFieldContainer,
  );
  public clientIdFieldInput =
    this.clientIdFieldContainer.getChildElementBySelector(Tags.input);
  public clientSecretFieldContainer =
    this.oAuthLoginForm.getChildElementBySelector(
      AddToolsetSettingsFormSelector.clientSecretFieldContainer,
    );
  public clientSecretFieldInput =
    this.clientSecretFieldContainer.getChildElementBySelector(Tags.input);
  public supportedScopes = new Combobox(
    this.page,
    this.oAuthLoginForm.getElementLocator(),
  );
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
  public apiKeyParameterNameFieldContainer =
    this.oAuthLoginForm.getChildElementBySelector(
      AddToolsetSettingsFormSelector.apiKeyParameterNameFieldContainer,
    );
  public apiKeyParameterNameFieldInput =
    this.apiKeyParameterNameFieldContainer.getChildElementBySelector(
      Tags.input,
    );
  public apiKeyParameterNameFieldError =
    this.oAuthLoginForm.getChildElementBySelector(
      AddToolsetSettingsFormSelector.apiKeyParameterNameFieldErrorMessage(),
    );
  public apiKeyParameterValueFieldContainer =
    this.oAuthLoginForm.getChildElementBySelector(
      AddToolsetSettingsFormSelector.apiKeyParameterValueFieldContainer,
    );
  public apiKeyParameterValueFieldInput =
    this.apiKeyParameterValueFieldContainer.getChildElementBySelector(
      Tags.input,
    );
  public allowedToolsLabel = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.allowedToolsLabel,
  );
  public allowedToolsLabelSubtitle = this.getChildElementBySelector(
    AddToolsetSettingsFormSelector.allowedToolsLabelSubtitle,
  );
  public allowedTools = new Combobox(this.page, this.rootLocator);
  public copyUrlButton = new Button(
    this.page,
    AddToolsetSettingsFormSelector.copyUrlButton,
  );

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

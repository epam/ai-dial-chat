import {
  AddToolsetSettingsFormSelector,
  IconSelectors,
} from '@/src/ui/selectors';
import { Combobox, EntityEditorViewForm } from '@/src/ui/webElements';

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
}

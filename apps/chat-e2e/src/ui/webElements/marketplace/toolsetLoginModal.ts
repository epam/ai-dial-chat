import { IconSelectors, ToolsetLoginModalSelectors } from '@/src/ui/selectors';
import { BaseElement, Button } from '@/src/ui/webElements';
import { FieldLabel } from '@/src/ui/webElements/fieldLabel';
import { Page } from '@playwright/test';

export class ToolsetLoginModal extends BaseElement {
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
}

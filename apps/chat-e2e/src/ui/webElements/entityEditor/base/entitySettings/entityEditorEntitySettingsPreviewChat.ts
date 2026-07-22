import { Tags } from '@/src/ui/domData';
import { EntityEditorEntitySettingsPreviewSelectors } from '@/src/ui/selectors';
import { BaseElement, Button } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class EntityEditorEntitySettingsPreviewChat extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      EntityEditorEntitySettingsPreviewSelectors.entitySettingsChatModeContainer,
      parentLocator,
    );
  }

  public introText = this.getChildElementBySelector(
    EntityEditorEntitySettingsPreviewSelectors.introText,
  );

  public getStarterButton(title: string): Button {
    return new Button(this.page, title, this.rootLocator);
  }

  public getStarterButtonLabel(title: string): BaseElement {
    return this.getStarterButton(title).getChildElementBySelector(Tags.span);
  }

  public previewChatIconContainer = this.getChildElementBySelector(
    EntityEditorEntitySettingsPreviewSelectors.previewIcon,
  );

  public previewChatIcon =
    this.previewChatIconContainer.getChildElementBySelector(Tags.img);

  public agentInfoContainer = this.getChildElementBySelector(
    EntityEditorEntitySettingsPreviewSelectors.entityInfoContainer,
  );

  public agentInfo = this.agentInfoContainer.getChildElementBySelector(
    EntityEditorEntitySettingsPreviewSelectors.entityInfo,
  );

  public agentName = this.agentInfo.getChildElementBySelector(
    EntityEditorEntitySettingsPreviewSelectors.entityName,
  );
}

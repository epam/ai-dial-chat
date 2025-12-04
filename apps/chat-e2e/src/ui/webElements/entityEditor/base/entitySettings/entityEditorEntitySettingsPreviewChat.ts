import { Tags } from '@/src/ui/domData';
import { EntityEditorEntitySettingsPreviewSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class EntityEditorEntitySettingsPreviewChat extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      EntityEditorEntitySettingsPreviewSelectors.entitySettingsChatModeContainer,
      parentLocator,
    );
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

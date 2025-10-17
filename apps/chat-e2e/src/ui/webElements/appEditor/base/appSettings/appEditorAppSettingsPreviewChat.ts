import { Tags } from '@/src/ui/domData';
import { AppEditorAppSettingsPreviewSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorAppSettingsPreviewChat extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      AppEditorAppSettingsPreviewSelectors.appSettingsChatModeContainer,
      parentLocator,
    );
  }

  public previewChatIconContainer = this.getChildElementBySelector(
    AppEditorAppSettingsPreviewSelectors.previewIcon,
  );

  public previewChatIcon =
    this.previewChatIconContainer.getChildElementBySelector(Tags.img);

  public agentInfoContainer = this.getChildElementBySelector(
    AppEditorAppSettingsPreviewSelectors.agentInfoContainer,
  );

  public agentInfo = this.agentInfoContainer.getChildElementBySelector(
    AppEditorAppSettingsPreviewSelectors.agentInfo,
  );

  public agentName = this.agentInfo.getChildElementBySelector(
    AppEditorAppSettingsPreviewSelectors.agentName,
  );
}

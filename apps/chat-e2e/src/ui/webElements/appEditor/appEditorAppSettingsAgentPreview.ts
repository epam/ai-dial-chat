import { Tags } from '@/src/ui/domData';
import {
  AppEditorAppSettingsPreviewSelectors,
  ChatSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorAppSettingsAgentPreview extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, AppEditorAppSettingsPreviewSelectors.container, parentLocator);
  }

  public appSettingsChatMode = this.getChildElementBySelector(
    AppEditorAppSettingsPreviewSelectors.appSettingsChatModeContainer,
  );

  public previewChatIconContainer =
    this.appSettingsChatMode.getChildElementBySelector(
      AppEditorAppSettingsPreviewSelectors.previewIcon,
    );

  public previewSpinner = this.getChildElementBySelector(ChatSelectors.spinner);

  public previewChatIcon =
    this.previewChatIconContainer.getChildElementBySelector(Tags.img);

  public agentInfoContainer =
    this.appSettingsChatMode.getChildElementBySelector(
      AppEditorAppSettingsPreviewSelectors.agentInfoContainer,
    );

  public agentInfo = this.agentInfoContainer.getChildElementBySelector(
    AppEditorAppSettingsPreviewSelectors.agentInfo,
  );

  public agentName = this.agentInfo.getChildElementBySelector(
    AppEditorAppSettingsPreviewSelectors.agentName,
  );
}

import { Tags } from '@/src/ui/domData';
import {
  AppEditorAppSettingsPreviewSelectors,
  AppEditorGeneralInfoPreviewSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorAppSettingsAgentPreview extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, AppEditorAppSettingsPreviewSelectors.container, parentLocator);
  }

  public appEditorChatMode = this.getChildElementBySelector(
    AppEditorAppSettingsPreviewSelectors.chatPreviewContainer,
  );

  public previewChatIconContainer =
    this.appEditorChatMode.getChildElementBySelector(
      AppEditorGeneralInfoPreviewSelectors.previewIconContainer,
    );

  public previewChatIcon =
    this.previewChatIconContainer.getChildElementBySelector(Tags.img);
}

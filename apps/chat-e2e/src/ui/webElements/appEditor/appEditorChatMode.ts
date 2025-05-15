import { Tags } from '@/src/ui/domData';
import {
  AppEditorAppSettingsPreviewSelectors,
  AppEditorGeneralInfoPreviewSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorChatMode extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      AppEditorAppSettingsPreviewSelectors.chatPreviewContainer,
      parentLocator,
    );
  }

  public previewChatIconContainer = this.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.previewIconContainer,
  );

  public previewChatIcon =
    this.previewChatIconContainer.getChildElementBySelector(Tags.img);
}

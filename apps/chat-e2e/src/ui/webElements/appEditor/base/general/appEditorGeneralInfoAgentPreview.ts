import {
  AppEditorGeneralInfoPreviewSelectors,
  ChatSelectors,
} from '@/src/ui/selectors';
import {
  AppEditorPreviewCard,
  AppEditorPreviewToggle,
  BaseElement,
} from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorGeneralInfoAgentPreview extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(
      page,
      AppEditorGeneralInfoPreviewSelectors.fullContainer,
      parentLocator,
    );
  }

  private appEditorPreviewToggle!: AppEditorPreviewToggle;
  private appEditorPreviewCard!: AppEditorPreviewCard;

  public getAppEditorPreviewToggle() {
    if (!this.appEditorPreviewToggle) {
      this.appEditorPreviewToggle = new AppEditorPreviewToggle(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorPreviewToggle;
  }

  public getAppEditorPreviewCard() {
    if (!this.appEditorPreviewCard) {
      this.appEditorPreviewCard = new AppEditorPreviewCard(
        this.page,
        this.rootLocator,
      );
    }
    return this.appEditorPreviewCard;
  }

  public previewSpinner = this.getChildElementBySelector(ChatSelectors.spinner);
}

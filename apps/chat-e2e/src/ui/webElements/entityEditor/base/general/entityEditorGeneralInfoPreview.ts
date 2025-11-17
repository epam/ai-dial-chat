import {
  ChatSelectors,
  EntityEditorGeneralInfoPreviewSelectors,
} from '@/src/ui/selectors';
import {
  BaseElement,
  EntityEditorPreviewCard,
  EntityEditorPreviewToggle,
} from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class EntityEditorGeneralInfoPreview extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(
      page,
      EntityEditorGeneralInfoPreviewSelectors.fullContainer,
      parentLocator,
    );
  }

  private entityEditorPreviewToggle!: EntityEditorPreviewToggle;
  private entityEditorPreviewCard!: EntityEditorPreviewCard;

  public getEntityEditorPreviewToggle() {
    if (!this.entityEditorPreviewToggle) {
      this.entityEditorPreviewToggle = new EntityEditorPreviewToggle(
        this.page,
        this.rootLocator,
      );
    }
    return this.entityEditorPreviewToggle;
  }

  public getEntityEditorPreviewCard() {
    if (!this.entityEditorPreviewCard) {
      this.entityEditorPreviewCard = new EntityEditorPreviewCard(
        this.page,
        this.rootLocator,
      );
    }
    return this.entityEditorPreviewCard;
  }

  public previewSpinner = this.getChildElementBySelector(ChatSelectors.spinner);
}

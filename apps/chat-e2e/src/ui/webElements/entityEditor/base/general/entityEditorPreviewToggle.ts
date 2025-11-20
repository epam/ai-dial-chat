import { Tags } from '@/src/ui/domData';
import { EntityEditorPreviewToggleSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class EntityEditorPreviewToggle extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(
      page,
      EntityEditorPreviewToggleSelectors.toggleContainer,
      parentLocator,
    );
  }

  public detailedSwitch = this.getChildElementBySelector(
    EntityEditorPreviewToggleSelectors.detailedSwitch,
  ).getChildElementBySelector(Tags.label);
}

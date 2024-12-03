import { ReplaySelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class ReplayAsIs extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ReplaySelectors.replayAsIs, parentLocator);
  }

  public replayAsIsLabel = this.getChildElementBySelector(
    ReplaySelectors.replayAsIsLabel,
  );

  public replayAsIsDescr = this.getChildElementBySelector(
    ReplaySelectors.replayDescription,
  );

  public replayOldVersionWarning = this.getChildElementBySelector(
    ReplaySelectors.replayOldVersion,
  );
}

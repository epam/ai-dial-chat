import { ReplaySelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ReplayAsIs extends BaseElement {
  constructor(page: Page) {
    super(page, ReplaySelectors.replayAsIs);
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

  public async getReplayAsIsLabelText() {
    return this.replayAsIsLabel.getElementContent();
  }
}

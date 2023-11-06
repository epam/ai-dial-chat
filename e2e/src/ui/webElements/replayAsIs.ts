import { ChatSelectors } from '@/e2e/src/ui/selectors';
import { BaseElement } from '@/e2e/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ReplayAsIs extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.replayAsIs);
  }

  public replayAsIsLabel = this.getChildElementBySelector(
    ChatSelectors.replayAsIsLabel,
  );

  public async getReplayAsIsLabelText() {
    return this.replayAsIsLabel.getElementContent();
  }
}

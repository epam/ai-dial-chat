import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class ReplayAsIs extends BaseElement {
  constructor(page: Page) {
    super(page, ChatSelectors.replayAsIs);
  }

  public replayAsIsLabel = this.getChildElementBySelector(
    ChatSelectors.replayAsIsLabel,
  );

  public replayAsIsDescr = this.getChildElementBySelector(
    ChatSelectors.replayDescription,
  );

  public replayOldVersionWarning = this.getChildElementBySelector(
    ChatSelectors.replayOldVersion,
  );

  public async getReplayAsIsLabelText() {
    return this.replayAsIsLabel.getElementContent();
  }
}

import { NotFoundSelectors } from '@/src/ui/selectors/notFoundSelectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class NotFound extends BaseElement {
  constructor(page: Page) {
    super(page, NotFoundSelectors.container);
  }

  public header = this.getChildElementBySelector(NotFoundSelectors.header);
  public title = this.getChildElementBySelector(NotFoundSelectors.title);
  public description = this.getChildElementBySelector(
    NotFoundSelectors.description,
  );
  public newConversationButton = this.getChildElementBySelector(
    NotFoundSelectors.newConversationButton,
  );
}

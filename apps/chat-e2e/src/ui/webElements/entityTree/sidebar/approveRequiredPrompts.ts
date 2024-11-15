import { EntitySelectors, PromptBarSelectors } from '@/src/ui/selectors';
import { Folders } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class ApproveRequiredPrompts extends Folders {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PromptBarSelectors.approveRequiredPrompts(),
      EntitySelectors.prompt,
    );
  }
}

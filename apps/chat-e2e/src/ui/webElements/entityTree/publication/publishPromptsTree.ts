import {
  EntitySelectors,
  IconSelectors,
  PublishingTreeSelectors,
} from '@/src/ui/selectors';
import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree/publishEntitiesTree';
import { Locator, Page } from '@playwright/test';

export class PublishPromptsTree extends PublishEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingTreeSelectors.promptsTree,
      EntitySelectors.prompt,
    );
  }

  public promptIcon = (
    name: string,
    indexOrOptions?: number | { exactMatch: boolean; index?: number },
  ) =>
    this.getTreeEntity(name, indexOrOptions).locator(IconSelectors.promptIcon);
}

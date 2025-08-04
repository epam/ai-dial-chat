import {
  EntitySelectors,
  IconSelectors,
  PublishingApprovalModalSelectors,
} from '@/src/ui/selectors';
import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree/publishEntitiesTree';
import { Locator, Page } from '@playwright/test';

export class PromptsToApproveTree extends PublishEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingApprovalModalSelectors.promptsToApproveContainer,
      EntitySelectors.prompt,
    );
  }

  public promptIcon = (
    name: string,
    indexOrOptions?: number | { exactMatch: boolean; index?: number },
  ) =>
    this.getTreeEntity(name, indexOrOptions).locator(IconSelectors.promptIcon);
}

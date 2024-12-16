import { ApproveRequiredEntitiesTree } from './approveRequiredEntitiesTree';

import { EntitySelectors, PromptBarSelectors } from '@/src/ui/selectors';
import { Locator, Page } from '@playwright/test';

export class ApproveRequiredPrompts extends ApproveRequiredEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PromptBarSelectors.approveRequiredPrompts(),
      EntitySelectors.prompt,
    );
  }
}

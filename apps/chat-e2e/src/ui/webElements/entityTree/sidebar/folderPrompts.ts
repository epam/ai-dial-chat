import { EntitySelectors, PromptBarSelectors } from '../../../selectors';

import { Folders } from '@/src/ui/webElements/entityTree/folders';
import { Locator, Page } from '@playwright/test';

export enum PromptBarSection {
  Organization = 'Organization',
  PinnedPrompts = 'PinnedPrompts',
  SharedWithMe = 'SharedWithMe',
  ApproveRequired = 'ApproveRequired',
}

export class FolderPrompts extends Folders {
  constructor(page: Page, parentLocator: Locator, section?: PromptBarSection) {
    let selector: string;
    switch (section) {
      case PromptBarSection.Organization:
        selector = PromptBarSelectors.organizationPrompts();
        break;
      case PromptBarSection.PinnedPrompts:
        selector = PromptBarSelectors.pinnedPrompts();
        break;
      case PromptBarSection.SharedWithMe:
        selector = PromptBarSelectors.sharedWithMePrompts();
        break;
      case PromptBarSection.ApproveRequired:
        selector = PromptBarSelectors.approveRequiredPrompts();
        break;
      default:
        selector = PromptBarSelectors.pinnedPrompts();
    }
    super(page, parentLocator, selector, EntitySelectors.prompt);
  }
}

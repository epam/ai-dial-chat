import {
  EntityTreeSelectors,
  PublishingModalSelectors,
} from '@/src/ui/selectors';
import { PublishFolder } from '@/src/ui/webElements/entityTree';
import { Locator, Page } from '@playwright/test';

export class FolderPromptsToPublish extends PublishFolder {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingModalSelectors.promptsToPublishContainer,
      EntityTreeSelectors.prompt,
    );
  }
}

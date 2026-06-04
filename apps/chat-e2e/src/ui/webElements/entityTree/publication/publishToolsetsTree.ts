import {
  EntitySelectors,
  IconSelectors,
  PublishingTreeSelectors,
} from '../../../selectors';

import { Tags } from '@/src/ui/domData';
import { PublishEntitiesTree } from '@/src/ui/webElements/entityTree/publishEntitiesTree';
import { Locator, Page } from '@playwright/test';

export class PublishToolsetsTree extends PublishEntitiesTree {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      PublishingTreeSelectors.toolsetsTree,
      EntitySelectors.toolset,
    );
  }

  public credentials = this.getChildElementBySelector(
    PublishingTreeSelectors.credentials,
  );
  public credentialsCheckbox = this.credentials.getChildElementBySelector(
    Tags.input,
  );
  public credentialsIcon = this.credentials.getChildElementBySelector(
    IconSelectors.keyIcon,
  );
}

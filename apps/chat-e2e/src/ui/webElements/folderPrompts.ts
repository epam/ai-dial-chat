import { PromptBarSelectors } from '../selectors';

import { Folders } from '@/src/ui/webElements/folders';
import { Page } from '@playwright/test';

export class FolderPrompts extends Folders {
  constructor(page: Page) {
    super(
      page,
      PromptBarSelectors.promptFolders,
      PromptBarSelectors.promptName,
    );
  }
}

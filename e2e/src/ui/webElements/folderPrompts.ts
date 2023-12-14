import { PromptBarSelectors, SideBarSelectors } from '../selectors';

import { Tags } from '@/e2e/src/ui/domData';
import { Folders } from '@/e2e/src/ui/webElements/folders';
import { Page } from '@playwright/test';

export class FolderPrompts extends Folders {
  constructor(page: Page) {
    super(page, PromptBarSelectors.promptFolders);
  }

  public folderPromptDotsMenu = (folderName: string, promptName: string) => {
    return this.getFolderPrompt(folderName, promptName).locator(
      SideBarSelectors.dotsMenu,
    );
  };

  public getFolderPrompts(name: string, index?: number) {
    return this.getFolderByName(name, index).locator(
      `~${Tags.div} ${PromptBarSelectors.prompt}`,
    );
  }

  public getFolderPromptsCount() {
    return this.getChildElementBySelector(
      PromptBarSelectors.prompt,
    ).getElementsCount();
  }

  public getFolderPrompt(folderName: string, promptName: string) {
    return this.getFolderPrompts(folderName).filter({
      hasText: promptName,
    });
  }

  public async isFolderPromptVisible(folderName: string, promptName: string) {
    return this.getFolderPrompt(folderName, promptName).isVisible();
  }

  public async openFolderPromptDropdownMenu(
    folderName: string,
    promptName: string,
  ) {
    const folderPrompt = await this.getFolderPrompt(folderName, promptName);
    await folderPrompt.hover();
    await this.folderPromptDotsMenu(folderName, promptName).click();
    await this.getDropdownMenu().waitForState();
  }
}

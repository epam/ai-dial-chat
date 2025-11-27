import { ImportResolutionOption } from '@/src/testData';
import { ReplaceConfirmationModalSelectors } from '@/src/ui/selectors/dialogSelectors';
import { EntitySelectors } from '@/src/ui/selectors/entitySelectors';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { EntitiesTree } from '@/src/ui/webElements/entityTree/entitiesTree';
import { Locator, Page } from '@playwright/test';

export class ReplaceConfirmationModalConversations extends EntitiesTree {
  private dropdownMenu!: DropdownButtonMenu;

  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      parentLocator,
      ReplaceConfirmationModalSelectors.modalContainer,
      EntitySelectors.conversation,
    );
  }

  private getDropdownMenu(): DropdownButtonMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.dropdownMenu;
  }

  public getConversationDropdownByName(conversationName: string) {
    return this.getConversationRowByName(conversationName).locator(
      ReplaceConfirmationModalSelectors.dropdownTrigger,
    );
  }

  private getConversationRowByName(conversationName: string) {
    return this.getChildElementBySelector(EntitySelectors.conversation)
      .getElementLocator()
      .filter({
        has: this.page.locator(EntitySelectors.entityName).filter({
          hasText: conversationName,
        }),
      });
  }

  public async setConversationOption(
    conversationName: string,
    option: ImportResolutionOption,
  ) {
    await this.getConversationDropdownByName(conversationName).click();
    await this.getDropdownMenu().selectMenuOption(option, {
      isHttpMethodTriggered: false,
    });
  }
}

import { isApiStorageType } from '@/src/hooks/global-setup';
import { keys } from '@/src/ui/keyboard';
import { ChatBarSelectors } from '@/src/ui/selectors';
import { SideBarEntitiesTree } from '@/src/ui/webElements/entityTree/sidebar/sideBarEntitiesTree';

export class BaseSideBarConversationTree extends SideBarEntitiesTree {
  public async selectConversation(name: string, indexOrOptions?: number | { exactMatch: boolean, index?: number }) {
    let conversationToSelect;
    let index: number | undefined;

    if (typeof indexOrOptions === 'number') {
      // Existing behavior
      index = indexOrOptions;
      conversationToSelect = this.getEntityByName(name, index);
    } else if (typeof indexOrOptions === 'object' && indexOrOptions.exactMatch) {
      // New exact match behavior
      index = indexOrOptions.index;
      conversationToSelect = this.getEntityByExactName(name, index);
    } else {
      // Default behavior (partial match, no index)
      conversationToSelect = this.getEntityByName(name);
    }

    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'GET',
      );
      await conversationToSelect.click();
      return respPromise;
    }
    await conversationToSelect.click();
  }
  public selectedConversation(name: string, index?: number) {
    return this.getEntityByName(name, index).locator(
      ChatBarSelectors.selectedEntity,
    );
  }

  public async editConversationNameWithTick(newName: string) {
    await this.openEditEntityNameMode(newName);
    const editInputActions = this.getEditInputActions();
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'DELETE',
      );
      await editInputActions.clickTickButton();
      return respPromise;
    }
    await editInputActions.clickTickButton();
  }

  public async editConversationNameWithEnter(newName: string) {
    await this.openEditEntityNameMode(newName);
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'DELETE',
      );
      await this.page.keyboard.press(keys.enter);
      return respPromise;
    }
    await this.page.keyboard.press(keys.enter);
  }
}

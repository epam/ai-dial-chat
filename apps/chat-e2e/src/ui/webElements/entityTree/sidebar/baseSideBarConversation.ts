import { isApiStorageType } from '@/src/hooks/global-setup';
import { keys } from '@/src/ui/keyboard';
import { ChatBarSelectors } from '@/src/ui/selectors';
import { SideBarEntities } from '@/src/ui/webElements/entityTree/sidebar/sideBarEntities';

export class BaseSideBarConversation extends SideBarEntities {
  public async selectConversation(name: string, index?: number) {
    const conversationToSelect = this.getEntityByName(name, index);
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
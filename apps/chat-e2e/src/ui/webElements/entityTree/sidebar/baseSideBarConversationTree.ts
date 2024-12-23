import { isApiStorageType } from '@/src/hooks/global-setup';
import { ChatBarSelectors } from '@/src/ui/selectors';
import { SideBarEntitiesTree } from '@/src/ui/webElements/entityTree/sidebar/sideBarEntitiesTree';

export class BaseSideBarConversationTree extends SideBarEntitiesTree {
  public async selectConversation(
    name: string,
    indexOrOptions?: number | { exactMatch: boolean; index?: number },
    { isHttpMethodTriggered = true }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const conversationToSelect = this.getTreeEntity(name, indexOrOptions);
    if (isApiStorageType && isHttpMethodTriggered) {
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
}

import { isApiStorageType } from '@/src/hooks/global-setup';
import { Colors } from '@/src/ui/domData';
import { ChatBarSelectors } from '@/src/ui/selectors';
import { SideBarEntitiesTree } from '@/src/ui/webElements/entityTree/sidebar/sideBarEntitiesTree';

export class BaseSideBarConversationTree extends SideBarEntitiesTree {
  public async selectConversation(
    name: string,
    indexOrOptions?: number | { exactMatch: boolean; index?: number },
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
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
    if (index) {
      return this.getEntityByName(name, index).locator(
        ChatBarSelectors.selectedEntity,
      );
    } else {
      return this.getEntityByExactName(name).locator(
        ChatBarSelectors.selectedEntity,
      );
    }
  }

  public async getSelectedEntities(): Promise<
    { name: string; index?: number }[]
  > {
    const allNames = await this.getAllTreeEntitiesNames();
    const selectedEntities = [];

    for (const name of allNames) {
      const hasSelectedClass =
        (await this.selectedConversation(name).count()) > 0;
      const backgroundColor = await this.getEntityBackgroundColor(name);

      if (
        hasSelectedClass ||
        backgroundColor === Colors.backgroundAccentSecondary
      ) {
        selectedEntities.push({ name });
      }
    }
    return selectedEntities;
  }
}

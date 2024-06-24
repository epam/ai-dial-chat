import {
  ShareByLinkResponseModel,
  ShareRequestModel,
} from '@/chat/types/share';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { MenuOptions } from '@/src/testData';
import { keys } from '@/src/ui/keyboard';
import { ChatBarSelectors, IconSelectors } from '@/src/ui/selectors';
import { SideBarEntities } from '@/src/ui/webElements/sideBarEntities';

export class BaseConversation extends SideBarEntities {
  public getConversationByName(name: string, index?: number) {
    return this.getEntityByName(this.entitySelector, name, index);
  }

  public getConversationName(name: string, index?: number) {
    return this.getEntityName(
      this.entitySelector,
      ChatBarSelectors.conversationName,
      name,
      index,
    );
  }

  public async selectConversation(name: string, index?: number) {
    const conversationToSelect = this.getConversationByName(name, index);
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
    return this.getConversationByName(name, index).locator(
      ChatBarSelectors.selectedEntity,
    );
  }

  public async openConversationDropdownMenu(name: string, index?: number) {
    await this.openEntityDropdownMenu(this.entitySelector, name, index);
  }

  public async editConversationNameWithTick(newName: string) {
    await this.openEditConversationNameMode(newName);
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
    await this.openEditConversationNameMode(newName);
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'DELETE',
      );
      await this.page.keyboard.press(keys.enter);
      return respPromise;
    }
    await this.page.keyboard.press(keys.enter);
  }

  public async openEditConversationNameMode(newName: string) {
    return this.openEditEntityNameMode(newName);
  }

  public async shareConversation() {
    const response = await this.selectEntityMenuOption(MenuOptions.share, {
      triggeredHttpMethod: 'POST',
    });
    if (response !== undefined) {
      const responseText = await response.text();
      const request = await response.request().postDataJSON();
      return {
        request: request as ShareRequestModel,
        response: JSON.parse(responseText) as ShareByLinkResponseModel,
      };
    }
  }

  public async getConversationIcon(name: string, index?: number) {
    return this.getEntityIcon(this.entitySelector, name, index);
  }

  public getConversationPlaybackIcon(name: string, index?: number) {
    return this.getConversationByName(name, index).locator(
      IconSelectors.playbackIcon,
    );
  }

  public async getConversationBackgroundColor(name: string, index?: number) {
    return this.getEntityBackgroundColor(this.entitySelector, name, index);
  }
}

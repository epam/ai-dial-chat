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

  public async openConversationDropdownMenu(name: string, index?: number) {
    await this.openEntityDropdownMenu(this.entitySelector, name, index);
  }

  public async editConversationNameWithTick(newName: string) {
    const input = await this.openEditConversationNameMode(newName);
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'DELETE',
      );
      await input.clickTickButton();
      return respPromise;
    }
    await input.clickTickButton();
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
    return this.openEditEntityNameMode(this.entitySelector, newName);
  }

  public async selectMenuOption(option: MenuOptions) {
    const menu = this.getDropdownMenu();
    if (isApiStorageType) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'POST',
      );
      await menu.selectMenuOption(option);
      const response = await respPromise;
      const responseText = await response.text();
      const request = await response.request().postDataJSON();
      return {
        request: request as ShareRequestModel,
        response: JSON.parse(responseText) as ShareByLinkResponseModel,
      };
    }
    await menu.selectMenuOption(option);
  }

  public async getConversationIcon(name: string, index?: number) {
    return this.getEntityIcon(this.entitySelector, name, index);
  }

  public async isConversationHasPlaybackIcon(name: string, index?: number) {
    const playBackIcon = this.getConversationByName(name, index).locator(
      IconSelectors.playbackIcon,
    );
    return playBackIcon.isVisible();
  }

  public async getConversationBackgroundColor(name: string, index?: number) {
    return this.getEntityBackgroundColor(this.entitySelector, name, index);
  }
}

import { ChatBarSelectors } from '../selectors';

import {
  ShareByLinkResponseModel,
  ShareRequestModel,
} from '@/chat/types/share';
import { MenuOptions } from '@/src/testData';
import { Folders } from '@/src/ui/webElements/folders';
import { Page } from '@playwright/test';

export class FolderConversations extends Folders {
  constructor(page: Page) {
    super(page, ChatBarSelectors.pinnedChats(), ChatBarSelectors.conversationName);
  }

  public async selectShareMenuOption() {
    const menu = this.getDropdownMenu();
    const respPromise = this.page.waitForResponse(
      (resp) => resp.request().method() === 'POST',
    );
    await menu.selectMenuOption(MenuOptions.share);
    const response = await respPromise;
    const request = (await response
      .request()
      .postDataJSON()) as ShareRequestModel;
    const responseText = await response.text();
    return {
      request: request,
      response: JSON.parse(responseText) as ShareByLinkResponseModel,
    };
  }
}

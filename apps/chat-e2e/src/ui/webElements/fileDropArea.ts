import { API } from '@/src/testData';
import { DropImplementation, FileMetadata } from '@/src/ui/pages';
import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Chat } from '@/src/ui/webElements/chat';
import { Locator, Page } from '@playwright/test';
import {BackendDataEntity} from "@/chat/types/common";

export class FileDropArea extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.fileDropArea, parentLocator);
  }

  private chat!: Chat;

  getChat(): Chat {
    if (!this.chat) {
      this.chat = new Chat(this.page, this.rootLocator);
    }
    return this.chat;
  }

  public async dragAndDropFile(
    fileMetadata: FileMetadata,
    options: {
      implementation: DropImplementation;
    },
    { isHttpMethodTriggered = true }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    if (isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (response) =>
          response.url().includes(API.fileHost()) &&
          response.request().method() === 'POST' &&
          response.status() === 200,
      );
      await options.implementation(fileMetadata, this, 'onDrop');
      const resolvedResp = await respPromise;
      const responseBody = await resolvedResp.json();
      return responseBody as BackendDataEntity;
    }
  }
}

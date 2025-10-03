import { BackendDataEntity } from '@/chat/types/common';
import { ExpectedConstants } from '@/src/testData';
import { DropImplementation, FileMetadata } from '@/src/ui/pages';
import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Chat } from '@/src/ui/webElements/chat';
import { DragFile } from '@/src/ui/webElements/dragFile';
import { ItemUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';

export class FileDropArea extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.fileDropArea, parentLocator);
  }

  private chat!: Chat;
  private dragFile!: DragFile;

  getChat(): Chat {
    if (!this.chat) {
      this.chat = new Chat(this.page, this.rootLocator);
    }
    return this.chat;
  }

  getDragFile(): DragFile {
    if (!this.dragFile) {
      this.dragFile = new DragFile(this.page, this.rootLocator);
    }
    return this.dragFile;
  }

  public async dragAndDropFiles(
    filesMetadata: FileMetadata[],
    options: {
      implementation: DropImplementation;
    },
    { isHttpMethodTriggered = true }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    if (isHttpMethodTriggered) {
      const respPromises = [];
      for (const fileMetadata of filesMetadata) {
        const urlFilename = ExpectedConstants.replacedRestrictedCharsName(
          fileMetadata.name.substring(0, fileMetadata.name.lastIndexOf('.')),
        );
        const respPromise = this.page.waitForResponse(
          (response) =>
            response.url().includes(ItemUtil.getEncodedItemId(urlFilename)) &&
            response.request().method() === 'POST' &&
            response.status() === 200,
        );
        respPromises.push(respPromise);
      }

      await options.implementation(filesMetadata, this, 'onDrop');
      const responses = await Promise.all(respPromises);

      const responseBodies: BackendDataEntity[] = [];
      for (const response of responses) {
        const responseBody = await response?.json();
        responseBodies.push(responseBody as BackendDataEntity);
      }
      return responseBodies;
    }
    await options.implementation(filesMetadata, this, 'onDrop');
  }
}

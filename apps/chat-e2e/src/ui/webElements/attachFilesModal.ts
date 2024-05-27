import { BaseElement } from './baseElement';

import { AttachFilesModalSelectors } from '@/src/ui/selectors';
import { Page } from '@playwright/test';

export class AttachFilesModal extends BaseElement {
  constructor(page: Page) {
    super(page, AttachFilesModalSelectors.modalContainer);
  }

  public attachedFile = (filename: string) =>
    this.getChildElementBySelector(
      AttachFilesModalSelectors.attachedFile,
    ).getElementLocatorByText(filename);

  public attachedFileIcon = (filename: string) =>
    this.attachedFile(filename).locator(
      AttachFilesModalSelectors.attachedFileIcon,
    );

  public attachedFileName = (filename: string) =>
    this.createElementFromLocator(
      this.attachedFile(filename).locator(
        AttachFilesModalSelectors.attachedFileName,
      ),
    );

  public attachedFileCheckBox = (filename: string) =>
    this.attachedFileIcon(filename).getByRole('checkbox');

  public attachFilesButton = this.getChildElementBySelector(
    AttachFilesModalSelectors.attachFilesButton,
  );

  public async checkAttachedFile(filename: string) {
    await this.attachedFileIcon(filename).click();
  }

  public async attachFiles() {
    await this.attachFilesButton.click();
    await this.waitForState({ state: 'hidden' });
  }
}

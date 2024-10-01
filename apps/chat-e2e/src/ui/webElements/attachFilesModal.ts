import { BaseElement } from './baseElement';

import {
  AttachFilesModalSelectors,
  EntitySelectors,
  ErrorLabelSelectors,
  IconSelectors,
  MenuSelectors,
  SelectFolderModalSelectors,
} from '@/src/ui/selectors';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { AttachFilesTree, Folders } from '@/src/ui/webElements/entityTree';
import { FilesModalHeader } from '@/src/ui/webElements/filesModalHeader';
import { Page } from '@playwright/test';

export enum FileModalSection {
  AllFiles = 'all files',
  SharedWithMe = 'shared with me',
}
export class AttachFilesModal extends BaseElement {
  constructor(page: Page) {
    super(page, AttachFilesModalSelectors.modalContainer);
  }

  private fileDropdownMenu!: DropdownMenu;
  private modalHeader!: FilesModalHeader;
  //'All files' section entities
  private allFolderFiles!: Folders;
  private allFilesTree!: AttachFilesTree;

  private sharedWithMeTree!: AttachFilesTree;

  getFileDropdownMenu(): DropdownMenu {
    if (!this.fileDropdownMenu) {
      this.fileDropdownMenu = new DropdownMenu(this.page);
    }
    return this.fileDropdownMenu;
  }

  getModalHeader(): FilesModalHeader {
    if (!this.modalHeader) {
      this.modalHeader = new FilesModalHeader(this.page, this.rootLocator);
    }
    return this.modalHeader;
  }

  getAllFolderFiles(): Folders {
    if (!this.allFolderFiles) {
      this.allFolderFiles = new Folders(
        this.page,
        this.rootLocator,
        AttachFilesModalSelectors.allFilesContainer,
        EntitySelectors.file,
      );
    }
    return this.allFolderFiles;
  }

  getAllFilesTree(): AttachFilesTree {
    if (!this.allFilesTree) {
      this.allFilesTree = new AttachFilesTree(
        this.page,
        this.rootLocator,
        AttachFilesModalSelectors.allFilesContainer,
      );
    }
    return this.allFilesTree;
  }

  getSharedWithMeTree(): AttachFilesTree {
    if (!this.sharedWithMeTree) {
      this.sharedWithMeTree = new AttachFilesTree(
        this.page,
        this.rootLocator,
        AttachFilesModalSelectors.sharedWithMeFilesContainer,
      );
    }
    return this.sharedWithMeTree;
  }

  public attachFilesButton = this.getChildElementBySelector(
    AttachFilesModalSelectors.attachFilesButton,
  );

  public uploadFromDeviceButton = this.getChildElementBySelector(
    AttachFilesModalSelectors.uploadFromDeviceButton,
  );

  public deleteFilesButton = this.getChildElementBySelector(
    AttachFilesModalSelectors.deleteFilesButton,
  );

  public downloadFilesButton = this.getChildElementBySelector(
    AttachFilesModalSelectors.downloadFilesButton,
  );

  public newFolderButton = this.getChildElementBySelector(
    SelectFolderModalSelectors.newFolderButton,
  );

  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);

  // public async checkAttachedFile(filename: string) {
  //   await this.getAllFilesTree().attachedFileIcon(filename).click();
  // }

  public async checkAttachedFile(
    filename: string,
    section: FileModalSection = FileModalSection.AllFiles,
  ) {
    let treeElement;
    switch (section) {
      case FileModalSection.AllFiles:
        treeElement = this.getAllFilesTree();
        break;
      case FileModalSection.SharedWithMe:
        treeElement = this.getSharedWithMeTree();
        break;
      default:
        throw new Error(`Unknown file modal section: ${section}`);
    }
    await treeElement.attachedFileIcon(filename).click();
  }

  public async attachFiles() {
    await this.attachFilesButton.click();
    await this.waitForState({ state: 'hidden' });
  }

  public async openFileDropdownMenu(filename: string) {
    const file = this.getAllFilesTree().getEntityByName(filename);
    await file.hover();
    await file.locator(MenuSelectors.dotsMenu).click();
    await this.getFileDropdownMenu().waitForState();
  }

  public async getAttachedFileErrorMessage() {
    return this.getChildElementBySelector(
      ErrorLabelSelectors.errorText,
    ).getElementContent();
  }
}

import { BaseElement } from './baseElement';

import {
  AttachFilesModalSelectors,
  EntitySelectors,
  IconSelectors,
  MenuSelectors,
  SelectFolderModalSelectors,
} from '@/src/ui/selectors';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { AttachFilesTree, Folders } from '@/src/ui/webElements/entityTree';
import { FilesModalHeader } from '@/src/ui/webElements/filesModalHeader';
import { ModalError } from '@/src/ui/webElements/modalError';
import { Search } from '@/src/ui/webElements/search';
import { Locator, Page } from '@playwright/test';

export enum FileModalSection {
  AllFiles = 'All files',
  SharedWithMe = 'Shared with me',
  Organization = 'Organization',
}

export const invalidSectionError = (section: FileModalSection) =>
  `Unknown file modal section: ${section}`;

export class AttachFilesModal extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, AttachFilesModalSelectors.modalContainer, parentLocator);
  }

  private fileDropdownMenu!: DropdownMenu;
  private modalHeader!: FilesModalHeader;
  //'All files' section entities
  private allFolderFiles!: Folders;
  private allFilesTree!: AttachFilesTree;
  private sharedWithMeTree!: AttachFilesTree;
  private sharedWithMeFoldersTree!: Folders;
  private organizationTree!: AttachFilesTree;
  private organizationFoldersTree!: Folders;
  private search!: Search;
  public modalError!: ModalError;

  getSearchInput(): BaseElement {
    if (!this.search) {
      this.search = new Search(this.page, this.rootLocator);
    }
    return this.search;
  }

  getModalError(): ModalError {
    if (!this.modalError) {
      this.modalError = new ModalError(this.page, this.rootLocator);
    }
    return this.modalError;
  }

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

  public getSharedWithMeFilesContainer(): BaseElement {
    return this.getChildElementBySelector(
      AttachFilesModalSelectors.sharedWithMeFilesContainer,
    );
  }

  public async expandCollapseSection(section: FileModalSection) {
    let fileTree;
    if (section === FileModalSection.AllFiles) {
      fileTree = this.getAllFilesTree();
    } else if (section === FileModalSection.SharedWithMe) {
      fileTree = this.getSharedWithMeTree();
    } else if (section === FileModalSection.Organization) {
      fileTree = this.getOrganizationTree();
    }
    await fileTree!
      .getChildElementBySelector(AttachFilesModalSelectors.rootFolder)
      .click();
  }

  public getAllFilesContainer(): BaseElement {
    return this.getChildElementBySelector(
      AttachFilesModalSelectors.allFilesContainer,
    );
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

  getOrganizationTree(): AttachFilesTree {
    if (!this.organizationTree) {
      this.organizationTree = new AttachFilesTree(
        this.page,
        this.rootLocator,
        AttachFilesModalSelectors.organizationFilesContainer,
      );
    }
    return this.organizationTree;
  }

  getOrganizationFoldersTree(): Folders {
    if (!this.organizationFoldersTree) {
      this.organizationFoldersTree = new Folders(
        this.page,
        this.rootLocator,
        AttachFilesModalSelectors.organizationFilesContainer,
        EntitySelectors.file,
      );
    }
    return this.organizationFoldersTree;
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

  public getSectionElement(section: FileModalSection): BaseElement {
    switch (section) {
      case FileModalSection.AllFiles:
        return this.getChildElementBySelector(
          AttachFilesModalSelectors.allFilesContainer,
        );
      case FileModalSection.SharedWithMe:
        return this.getChildElementBySelector(
          AttachFilesModalSelectors.sharedWithMeFilesContainer,
        );
      case FileModalSection.Organization:
        return this.getChildElementBySelector(
          AttachFilesModalSelectors.organizationFilesContainer,
        );
      default:
        throw new Error(`Unknown section: ${section}`);
    }
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

  getSharedWithMeFoldersTree(): Folders {
    if (!this.sharedWithMeFoldersTree) {
      this.sharedWithMeFoldersTree = new Folders(
        this.page,
        this.rootLocator,
        AttachFilesModalSelectors.sharedWithMeFilesContainer,
        EntitySelectors.file,
      );
    }
    return this.sharedWithMeFoldersTree;
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

  public getFilesSection = (sectionElement: BaseElement) =>
    sectionElement
      .getChildElementBySelector(AttachFilesModalSelectors.fileSection)
      .getElementLocator();

  public closeButton = this.getChildElementBySelector(IconSelectors.cancelIcon);

  public getFilesTree(section: FileModalSection): AttachFilesTree {
    switch (section) {
      case FileModalSection.AllFiles:
        return this.getAllFilesTree();
      case FileModalSection.Organization:
        return this.getOrganizationTree();
      case FileModalSection.SharedWithMe:
        return this.getSharedWithMeTree();
      default:
        throw new Error(invalidSectionError(section));
    }
  }

  public getFoldersTree(section: FileModalSection) {
    switch (section) {
      case FileModalSection.AllFiles:
        return this.getAllFolderFiles();
      case FileModalSection.SharedWithMe:
        return this.getSharedWithMeFoldersTree();
      case FileModalSection.Organization:
        return this.getOrganizationFoldersTree();
      default:
        throw new Error(invalidSectionError(section));
    }
  }

  public async checkAttachedFile(
    filename: string,
    section: FileModalSection = FileModalSection.AllFiles,
  ) {
    const treeElement = this.getFilesTree(section);
    await treeElement.attachedFileIcon(filename).click();
  }

  public async attachFiles() {
    await this.attachFilesButton.click();
    await this.waitForState({ state: 'hidden' });
  }

  public async openFileDropdownMenu(
    filename: string,
    section: FileModalSection,
  ) {
    let fileTree;
    if (section === FileModalSection.AllFiles) {
      fileTree = this.getAllFilesTree();
    } else if (section === FileModalSection.SharedWithMe) {
      fileTree = this.getSharedWithMeTree();
    }
    const file = fileTree!.getEntityByName(filename);
    await file.hover();
    await file.locator(MenuSelectors.dotsMenu).click();
    await this.getFileDropdownMenu().waitForState();
  }

  public async uploadFromDevice() {
    const respPremise = this.page.waitForResponse(
      (r) => r.request().method() === 'GET' && r.status() === 200,
    );
    await this.uploadFromDeviceButton.click();
    await respPremise;
  }
}

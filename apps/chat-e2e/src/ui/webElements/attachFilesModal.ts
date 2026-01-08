import { BaseElement } from './baseElement';

import {
  ChatSelectors,
  EntitySelectors,
  FilesManagerModalSelectors,
  IconSelectors,
  MenuSelectors,
  SelectFolderModalSelectors,
} from '@/src/ui/selectors';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { AttachFilesTree, Folders } from '@/src/ui/webElements/entityTree';
import { FilesManagerModalHeader } from '@/src/ui/webElements/filesManagerModalHeader';
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
    super(page, FilesManagerModalSelectors.modalContainer, parentLocator);
  }

  private fileDropdownMenu!: DropdownMenu;
  private modalHeader!: FilesManagerModalHeader;
  //'All files' section entities
  private allFolderFiles!: Folders;
  private allFilesTree!: AttachFilesTree;
  private sharedWithMeTree!: AttachFilesTree;
  private sharedWithMeFolderFiles!: Folders;
  private organizationTree!: AttachFilesTree;
  private organizationFolderFiles!: Folders;
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

  getModalHeader(): FilesManagerModalHeader {
    if (!this.modalHeader) {
      this.modalHeader = new FilesManagerModalHeader(
        this.page,
        this.rootLocator,
      );
    }
    return this.modalHeader;
  }

  public getSharedWithMeFilesContainer(): BaseElement {
    return this.getChildElementBySelector(
      FilesManagerModalSelectors.sharedWithMeFilesContainer,
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
      .getChildElementBySelector(FilesManagerModalSelectors.rootFolder)
      .click();
  }

  public getAllFilesContainer(): BaseElement {
    return this.getChildElementBySelector(
      FilesManagerModalSelectors.allFilesContainer,
    );
  }

  getAllFolderFiles(): Folders {
    if (!this.allFolderFiles) {
      this.allFolderFiles = new Folders(
        this.page,
        this.rootLocator,
        FilesManagerModalSelectors.allFilesContainer,
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
        FilesManagerModalSelectors.organizationFilesContainer,
      );
    }
    return this.organizationTree;
  }

  getOrganizationFolderFiles(): Folders {
    if (!this.organizationFolderFiles) {
      this.organizationFolderFiles = new Folders(
        this.page,
        this.rootLocator,
        FilesManagerModalSelectors.organizationFilesContainer,
        EntitySelectors.file,
      );
    }
    return this.organizationFolderFiles;
  }

  getAllFilesTree(): AttachFilesTree {
    if (!this.allFilesTree) {
      this.allFilesTree = new AttachFilesTree(
        this.page,
        this.rootLocator,
        FilesManagerModalSelectors.allFilesContainer,
      );
    }
    return this.allFilesTree;
  }

  public getSectionElement(section: FileModalSection): BaseElement {
    switch (section) {
      case FileModalSection.AllFiles:
        return this.getChildElementBySelector(
          FilesManagerModalSelectors.allFilesContainer,
        );
      case FileModalSection.SharedWithMe:
        return this.getChildElementBySelector(
          FilesManagerModalSelectors.sharedWithMeFilesContainer,
        );
      case FileModalSection.Organization:
        return this.getChildElementBySelector(
          FilesManagerModalSelectors.organizationFilesContainer,
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
        FilesManagerModalSelectors.sharedWithMeFilesContainer,
      );
    }
    return this.sharedWithMeTree;
  }

  getSharedWithMeFolderFiles(): Folders {
    if (!this.sharedWithMeFolderFiles) {
      this.sharedWithMeFolderFiles = new Folders(
        this.page,
        this.rootLocator,
        FilesManagerModalSelectors.sharedWithMeFilesContainer,
        EntitySelectors.file,
      );
    }
    return this.sharedWithMeFolderFiles;
  }

  public attachFilesButton = this.getChildElementBySelector(
    FilesManagerModalSelectors.attachFilesButton,
  );

  public uploadFromDeviceButton = this.getChildElementBySelector(
    FilesManagerModalSelectors.uploadFromDeviceButton,
  );

  public deleteFilesButton = this.getChildElementBySelector(
    FilesManagerModalSelectors.deleteFilesButton,
  );

  public downloadFilesButton = this.getChildElementBySelector(
    FilesManagerModalSelectors.downloadFilesButton,
  );

  public newFolderButton = this.getChildElementBySelector(
    SelectFolderModalSelectors.newFolderButton,
  );

  public getFilesSection = (sectionElement: BaseElement) =>
    sectionElement
      .getChildElementBySelector(FilesManagerModalSelectors.fileSection)
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

  public getFolderTree(section: FileModalSection) {
    switch (section) {
      case FileModalSection.AllFiles:
        return this.getAllFolderFiles();
      case FileModalSection.SharedWithMe:
        return this.getSharedWithMeFolderFiles();
      case FileModalSection.Organization:
        return this.getOrganizationFolderFiles();
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
    const fileDotsMenu = file.locator(MenuSelectors.dotsMenu);
    const fileDotsMenuSpinner = fileDotsMenu.locator(
      ChatSelectors.entitySpinner,
    );
    await fileDotsMenu.click();
    await fileDotsMenuSpinner.waitFor({ state: 'hidden' });
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

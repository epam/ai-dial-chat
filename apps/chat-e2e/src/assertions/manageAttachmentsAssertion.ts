import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementCaretState,
  ElementState,
  ExpectedMessages,
  TreeEntity,
} from '@/src/testData';
import { AttachFilesModal, FileModalSection } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class ManageAttachmentsAssertion extends BaseAssertion {
  readonly attachFilesModal: AttachFilesModal;

  constructor(attachFilesModal: AttachFilesModal) {
    super();
    this.attachFilesModal = attachFilesModal;
  }

  public async assertFileIconState(
    section: FileModalSection,
    entity: TreeEntity,
    expectedState: ElementState,
  ) {
    const fileIcon = this.attachFilesModal
      .getFilesTree(section)
      .attachedFileIcon(entity.name, entity.index);
    await this.assertElementState(fileIcon, expectedState);
  }

  public async assertSharedFileArrowIconState(
    entity: TreeEntity,
    expectedState: ElementState,
  ) {
    const arrowIcon = this.attachFilesModal
      .getAllFilesTree()
      .getAttachedFileArrowIcon(entity.name, entity.index);
    expectedState === 'visible'
      ? await expect
          .soft(arrowIcon, ExpectedMessages.sharedEntityIconIsVisible)
          .toBeVisible()
      : await expect
          .soft(arrowIcon, ExpectedMessages.sharedEntityIconIsNotVisible)
          .toBeHidden();
  }

  public async assertEntityArrowIconColor(
    entity: TreeEntity,
    expectedColor: string,
  ) {
    const arrowIconElement = this.attachFilesModal
      .getAllFilesTree()
      .getAttachedFileArrowIcon(entity.name, entity.index);
    await this.assertElementColor(arrowIconElement, expectedColor);
  }

  public async assertEntityState(
    entity: TreeEntity,
    fileModalSection: FileModalSection,
    expectedState: ElementState,
  ) {
    const entityTree = this.attachFilesModal.getFilesTree(fileModalSection);
    const entityLocator = entityTree!.getEntityByName(
      entity.name,
      entity.index,
    );
    await this.assertElementState(
      entityLocator,
      expectedState,
      ExpectedMessages.entityIsVisible,
    );
  }

  public async assertFolderState(
    folderName: string,
    fileModalSection: FileModalSection,
    expectedState: ElementState,
  ) {
    const entityTree = this.attachFilesModal.getFolderTree(fileModalSection);
    await this.assertElementState(
      entityTree.getFolderName(folderName),
      expectedState,
      ExpectedMessages.entityIsVisible,
    );
  }

  public async assertFolderEntityState(
    folder: TreeEntity,
    entity: TreeEntity,
    fileModalSection: FileModalSection,
    expectedState: ElementState,
  ) {
    const entityTree = this.attachFilesModal.getFolderTree(fileModalSection);
    const folderEntity = entityTree.getFolderEntity(
      folder.name,
      entity.name,
      folder.index,
      entity.index,
    );
    await this.assertElementState(
      folderEntity,
      expectedState,
      ExpectedMessages.entityIsVisible,
    );
  }

  public async assertSectionState(
    section: FileModalSection,
    state: ElementCaretState,
  ) {
    const sectionElement = this.attachFilesModal.getSectionElement(section);
    const filesSection = this.attachFilesModal.getFilesSection(sectionElement);
    state === 'expanded'
      ? await expect(
          filesSection,
          `Section "${section}" is ${state}`,
        ).toBeVisible()
      : await expect(
          filesSection,
          `Section "${section}" is ${state}`,
        ).toBeHidden();
  }
}

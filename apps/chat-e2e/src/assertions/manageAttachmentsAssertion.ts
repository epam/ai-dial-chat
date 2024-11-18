import {
  ElementCaretState,
  ElementState,
  ExpectedMessages,
  TreeEntity,
} from '@/src/testData';
import { AttachFilesModal, FileModalSection } from '@/src/ui/webElements';
import { AttachFilesTree } from '@/src/ui/webElements/entityTree';
import { expect } from '@playwright/test';

export class ManageAttachmentsAssertion {
  readonly attachFilesModal: AttachFilesModal;

  constructor(attachFilesModal: AttachFilesModal) {
    this.attachFilesModal = attachFilesModal;
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
    const arrowIconColor = await this.attachFilesModal
      .getAllFilesTree()
      .getAttachedFileArrowIconColor(entity.name, entity.index);
    expect
      .soft(arrowIconColor[0], ExpectedMessages.sharedIconColorIsValid)
      .toBe(expectedColor);
  }

  public async assertEntityState(
    entity: TreeEntity,
    fileModalSection: FileModalSection,
    expectedState: ElementState,
  ) {
    let entityTree: AttachFilesTree;
    switch (fileModalSection) {
      case FileModalSection.AllFiles:
        entityTree = this.attachFilesModal.getAllFilesTree();
        break;
      case FileModalSection.SharedWithMe:
        entityTree = this.attachFilesModal.getSharedWithMeTree();
        break;
      case FileModalSection.Organization:
        entityTree = this.attachFilesModal.getOrganizationTree();
        break;
    }

    const entityLocator = entityTree!.getEntityByName(
      entity.name,
      entity.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(entityLocator, ExpectedMessages.entityIsVisible)
          .toBeVisible()
      : await expect
          .soft(entityLocator, ExpectedMessages.entityIsNotVisible)
          .toBeHidden();
  }

  public async assertSectionState(
    section: FileModalSection,
    state: ElementCaretState,
  ) {
    const sectionElement = this.attachFilesModal.getSectionElement(section);
    const isExpanded =
      await this.attachFilesModal.isSectionExpanded(sectionElement);
    state === 'expanded'
      ? expect(isExpanded, `Section "${section}" is ${state}`).toBeTruthy()
      : expect(isExpanded, `Section "${section}" is ${state}`).toBeFalsy();
  }
}

import { ElementState, ExpectedMessages, TreeEntity } from '@/src/testData';
import {AttachFilesModal, FileModalSection} from '@/src/ui/webElements';
import { expect } from '@playwright/test';
import {AttachFilesTree} from "@/src/ui/webElements/entityTree";

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
    if (fileModalSection===FileModalSection.AllFiles) {
      entityTree = this.attachFilesModal.getAllFilesTree();
    }
    else if (fileModalSection===FileModalSection.SharedWithMe) {
      entityTree=this.attachFilesModal.getSharedWithMeTree();
    }

    const entityLocator = entityTree!.getEntityByName(entity.name, entity.index);
    expectedState === 'visible'
      ? await expect
        .soft(entityLocator, ExpectedMessages.entityIsVisible)
        .toBeVisible()
      : await expect
        .soft(entityLocator, ExpectedMessages.entityIsNotVisible)
        .toBeHidden();
  }
}

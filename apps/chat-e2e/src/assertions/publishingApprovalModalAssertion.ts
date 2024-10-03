import { Publication } from '@/chat/types/publication';
import {
  ElementState,
  ExpectedConstants,
  ExpectedMessages,
  PublishingExpectedMessages,
} from '@/src/testData';
import { BaseElement, PublishingApprovalModal } from '@/src/ui/webElements';
import { DateUtil } from '@/src/utils';
import { expect } from '@playwright/test';

export class PublishingApprovalModalAssertion {
  readonly publishingApprovalModal: PublishingApprovalModal;

  constructor(publishingApprovalModal: PublishingApprovalModal) {
    this.publishingApprovalModal = publishingApprovalModal;
  }

  public async assertPublishingApprovalModalState(expectedState: ElementState) {
    expectedState === 'visible'
      ? await expect
          .soft(
            this.publishingApprovalModal.getElementLocator(),
            ExpectedMessages.modalWindowIsOpened,
          )
          .toBeVisible()
      : await expect
          .soft(
            this.publishingApprovalModal.getElementLocator(),
            ExpectedMessages.modalWindowIsClosed,
          )
          .toBeHidden();
  }

  public async assertPublishToLabelState(expectedState: ElementState) {
    await this.assertElementState(
      this.publishingApprovalModal.publishToPathLabel,
      expectedState,
      ExpectedConstants.publishToLabel,
    );
  }

  public async assertPublishToPath(expectedPath: string) {
    expect
      .soft(
        await this.publishingApprovalModal.publishToPath.getElementInnerContent(),
        PublishingExpectedMessages.publishToPathIsValid,
      )
      .toBe(expectedPath);
  }

  public async assertRequestCreationDate(publicationRequest: Publication) {
    expect
      .soft(
        await this.publishingApprovalModal.publishDate.getElementInnerContent(),
        PublishingExpectedMessages.publishToPathIsValid,
      )
      .toBe(
        DateUtil.convertUnixTimestampToLocalDate(publicationRequest.createdAt),
      );
  }

  public async assertRequestCreationDateLabelState(
    expectedState: ElementState,
  ) {
    await this.assertElementState(
      this.publishingApprovalModal.publishDateLabel,
      expectedState,
      ExpectedConstants.requestCreationDateLabel,
    );
  }

  public async assertAllowAccessLabelState(expectedState: ElementState) {
    await this.assertElementState(
      this.publishingApprovalModal.allowAccessLabel,
      expectedState,
      ExpectedConstants.allowAccessLabel,
    );
  }

  public async assertNoChangesLabelState(expectedState: ElementState) {
    await this.assertElementState(
      this.publishingApprovalModal.noChangesLabel,
      expectedState,
      ExpectedConstants.noChangesLabel,
    );
  }

  public async assertAvailabilityLabelState(expectedState: ElementState) {
    await this.assertElementState(
      this.publishingApprovalModal.availabilityLabel,
      expectedState,
      ExpectedConstants.availabilityLabel,
    );
  }

  public async assertElementState(
    element: BaseElement,
    expectedState: ElementState,
    expectedText?: string,
  ) {
    const elementLocator = element.getElementLocator();
    if (expectedState === 'visible') {
      await expect
        .soft(elementLocator, ExpectedMessages.entityIsVisible)
        .toBeVisible();
      if (expectedText !== undefined) {
        await expect
          .soft(elementLocator, ExpectedMessages.fieldLabelIsValid)
          .toHaveText(expectedText);
      }
    } else {
      await expect
        .soft(elementLocator, ExpectedMessages.entityIsVisible)
        .toBeHidden();
    }
  }
}

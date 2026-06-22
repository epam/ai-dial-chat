import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import {
  ElementState,
  ExpectedConstants,
  ExpectedMessages,
  PublishingExpectedMessages,
} from '@/src/testData';
import { BaseElement, EntityDetailsModal } from '@/src/ui/webElements';
import { DateUtil } from '@/src/utils';

export class EntityDetailsModalAssertion extends BaseAssertion {
  readonly entityDetailsModal: EntityDetailsModal;

  constructor(entityDetailsModal: EntityDetailsModal) {
    super();
    this.entityDetailsModal = entityDetailsModal;
  }

  public async assertEntityCommonAttributes(attributesToVerify: {
    expectedName?: string;
    expectedVersion?: string;
    expectedDescription?: string;
    expectedReleaseDate?: string | number;
    expectedAuthor?: string;
    expectedTopics?: string[];
    expectedIcon?: string | BaseElement;
    expectedCredsLabel?: string | string[];
    expectedManageCredsButtonState?: ElementState;
  }) {
    if (attributesToVerify.expectedName !== undefined) {
      await this.assertElementText(
        this.entityDetailsModal.entityName,
        attributesToVerify.expectedName,
      );
    }
    if (attributesToVerify.expectedVersion !== undefined) {
      await this.assertElementText(
        this.entityDetailsModal.entityVersion,
        attributesToVerify.expectedVersion,
      );
    }
    if (attributesToVerify.expectedDescription !== undefined) {
      await this.assertDescription(attributesToVerify.expectedDescription);
    }
    if (attributesToVerify.expectedReleaseDate !== undefined) {
      await this.assertEntityReleaseDate(
        attributesToVerify.expectedReleaseDate,
      );
    }
    if (attributesToVerify.expectedAuthor !== undefined) {
      await this.assertElementText(
        this.entityDetailsModal.entityAuthor,
        attributesToVerify.expectedAuthor,
      );
    }
    if (attributesToVerify.expectedTopics !== undefined) {
      await this.assertElementInnerText(
        this.entityDetailsModal.entityTopic,
        attributesToVerify.expectedTopics,
        PublishingExpectedMessages.publicationTopicsAreValid,
      );
    }
    if (attributesToVerify.expectedIcon !== undefined) {
      typeof attributesToVerify.expectedIcon === 'string'
        ? await this.assertEntityIcon(
            this.entityDetailsModal.icon,
            attributesToVerify.expectedIcon,
          )
        : await this.assertElementState(
            attributesToVerify.expectedIcon,
            'visible',
          );
    }
    if (attributesToVerify.expectedCredsLabel !== undefined) {
      await this.assertElementText(
        this.entityDetailsModal.credsLabel,
        attributesToVerify.expectedCredsLabel,
      );
    }
    if (attributesToVerify.expectedManageCredsButtonState !== undefined) {
      await this.assertElementState(
        this.entityDetailsModal.manageCredsButton,
        attributesToVerify.expectedManageCredsButtonState,
      );
    }
  }

  /**
   * Normalizes whitespace in a string, replacing multiple newlines with single ones
   * and trimming lines.
   * @param text The input string.
   * @returns The normalized string.
   */
  private normalizeDescriptionWhitespaces(
    text: string | null | undefined,
  ): string {
    if (!text) {
      return '';
    }
    return text
      .replace(/\r\n/g, '\n') // Normalize Windows line endings
      .replace(/\n{2,}/g, '\n') // Replace multiple newlines with one
      .split('\n') // Split into lines
      .map((line) => line.trim()) // Trim each line
      .join('\n') // Join back with single newlines
      .trim(); // Trim entire string
  }

  public async assertDescription(expectedDescription: string) {
    const actualDescriptionRaw =
      await this.entityDetailsModal.entityDescription.getElementContent();

    const actualNormalized =
      this.normalizeDescriptionWhitespaces(actualDescriptionRaw);
    const expectedNormalized =
      this.normalizeDescriptionWhitespaces(expectedDescription);

    this.assertValue(
      actualNormalized,
      expectedNormalized,
      ExpectedMessages.agentDescriptionIsValid,
    );
  }

  public async assertEntityName(expectedName: string) {
    await this.assertElementText(
      this.entityDetailsModal.entityName,
      expectedName,
      ExpectedMessages.agentNameIsValid,
    );
  }

  public async assertEntityVersion(expectedVersion: string) {
    await this.assertElementText(
      this.entityDetailsModal.entityVersion,
      expectedVersion,
      ExpectedMessages.agentVersionIsValid,
    );
  }

  public async assertEntityAuthor(author: string) {
    await this.assertElementText(
      this.entityDetailsModal.entityAuthor,
      author,
      ExpectedMessages.authorIsValid,
    );
  }

  public async assertEntityReleaseDate(expectedDate: number | string) {
    const date =
      typeof expectedDate === 'number'
        ? DateUtil.convertUnixTimestampToLocalDate(expectedDate)
        : expectedDate;
    await this.assertElementText(
      this.entityDetailsModal.entityReleaseDate,
      date,
      ExpectedMessages.releaseDateIsValid,
    );
  }

  public async assertEntityTopics(expectedTopics: string[]) {
    await this.assertElementInnerText(
      this.entityDetailsModal.entityTopic,
      expectedTopics,
      PublishingExpectedMessages.publicationTopicsAreValid,
    );
  }

  public async assertOpenInNewTabButtonTitle(
    viewportSize: null | { width: number; height: number },
  ) {
    viewportSize && viewportSize.width >= 768
      ? await this.assertElementText(
          this.entityDetailsModal.openInNewTabButtonTitle.getNthElement(1),
          ExpectedConstants.openInNewTabButtonTitle,
        )
      : await this.assertElementText(
          this.entityDetailsModal.openInNewTabButtonTitle.getNthElement(2),
          ExpectedConstants.openInNewTabButtonTitle.split(' ')[0],
        );
  }
}

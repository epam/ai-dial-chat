import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { EntityEditorPreviewCard } from '@/src/ui/webElements';

export class EntityEditorPreviewCardAssertion extends BaseAssertion {
  readonly entityEditorPreviewCard: EntityEditorPreviewCard;

  constructor(entityEditorPreviewCard: EntityEditorPreviewCard) {
    super();
    this.entityEditorPreviewCard = entityEditorPreviewCard;
  }

  public async assertPreviewCardAttributes(attributesToVerify: {
    expectedName?: string;
    expectedIcon?: string;
    expectedShortDescription?: string;
    expectedLongDescription?: string;
    expectedTopics?: string[];
    expectedAuthor?: string;
    expectedReleaseDate?: string;
  }) {
    if (attributesToVerify.expectedName !== undefined) {
      await this.assertElementText(
        this.entityEditorPreviewCard.previewName,
        attributesToVerify.expectedName,
      );
    }
    if (attributesToVerify.expectedIcon !== undefined) {
      await this.assertEntityIcon(
        this.entityEditorPreviewCard.previewIcon,
        attributesToVerify.expectedIcon,
      );
    }
    if (attributesToVerify.expectedShortDescription !== undefined) {
      await this.assertElementText(
        this.entityEditorPreviewCard.getShortDescriptionDetailedViewElement(),
        attributesToVerify.expectedShortDescription,
      );
    }
    if (attributesToVerify.expectedLongDescription !== undefined) {
      await this.assertElementText(
        this.entityEditorPreviewCard.getLongDescriptionDetailedViewElement(),
        attributesToVerify.expectedLongDescription,
      );
    }
    if (attributesToVerify.expectedTopics !== undefined) {
      await this.assertElementInnerText(
        this.entityEditorPreviewCard.topicElements,
        attributesToVerify.expectedTopics,
      );
    }
    if (attributesToVerify.expectedAuthor !== undefined) {
      await this.assertElementText(
        this.entityEditorPreviewCard.previewAuthorValue,
        attributesToVerify.expectedAuthor,
      );
    }
    if (attributesToVerify.expectedReleaseDate !== undefined) {
      await this.assertElementText(
        this.entityEditorPreviewCard.releaseDate,
        attributesToVerify.expectedReleaseDate,
      );
    }
  }
}

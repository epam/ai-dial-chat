import { Tags } from '@/src/ui/domData';
import {
  EntityEditorGeneralInfoPreviewSelectors,
  IconSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class EntityEditorPreviewCard extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(
      page,
      EntityEditorGeneralInfoPreviewSelectors.entityPreviewGeneralInfoContainer,
      parentLocator,
    );
  }

  public previewIconContainer = this.getChildElementBySelector(
    EntityEditorGeneralInfoPreviewSelectors.previewIconContainer,
  );

  public externalAppIcon = this.previewIconContainer.getChildElementBySelector(
    IconSelectors.externalAppIcon,
  );

  public previewIcon = this.getElementIcon(this.previewIconContainer);

  public previewName = this.getChildElementBySelector(
    EntityEditorGeneralInfoPreviewSelectors.previewEntityName,
  );

  public version = this.getChildElementBySelector(
    EntityEditorGeneralInfoPreviewSelectors.version,
  );

  public releaseDate = this.getChildElementBySelector(
    EntityEditorGeneralInfoPreviewSelectors.releaseDate,
  );

  public previewTopicsContainer = this.getChildElementBySelector(
    EntityEditorGeneralInfoPreviewSelectors.previewTopicsContainer,
  );

  public previewInformationSection = this.getChildElementBySelector(
    EntityEditorGeneralInfoPreviewSelectors.previewInformationSection,
  );

  public previewAuthorContainer =
    this.previewInformationSection.getChildElementBySelector(
      EntityEditorGeneralInfoPreviewSelectors.previewAuthorContainer,
    );

  public previewAuthorValue =
    this.previewAuthorContainer.getChildElementBySelector(
      EntityEditorGeneralInfoPreviewSelectors.previewAuthorValue,
    );

  public topicElements = this.previewTopicsContainer.getChildElementBySelector(
    Tags.span,
  );

  public entityDescriptionSection = this.getChildElementBySelector(
    EntityEditorGeneralInfoPreviewSelectors.description,
  );

  public descriptionParagraphs =
    this.entityDescriptionSection.getChildElementBySelector(Tags.p);

  public getShortDescriptionDetailedViewElement(): BaseElement {
    return this.createElementFromLocator(
      this.descriptionParagraphs.getNthElement(1),
    );
  }

  public getLongDescriptionDetailedViewElement(): BaseElement {
    return this.createElementFromLocator(
      this.descriptionParagraphs.getNthElement(2),
    );
  }
}

import { Tags } from '@/src/ui/domData';
import {
  AppEditorGeneralInfoPreviewSelectors,
  IconSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorPreviewCard extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(
      page,
      AppEditorGeneralInfoPreviewSelectors.appPreviewGeneralInfoContainer,
      parentLocator,
    );
  }

  public previewIconContainer = this.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.previewIconContainer,
  );

  public externalAppIcon = this.previewIconContainer.getChildElementBySelector(
    IconSelectors.externalAppIcon,
  );

  public previewIcon = this.previewIconContainer.getChildElementBySelector(
    Tags.img,
  );

  public previewName = this.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.previewAgentName,
  );

  public version = this.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.version,
  );

  public releaseDate = this.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.releaseDate,
  );

  public previewTopicsContainer = this.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.previewTopicsContainer,
  );

  public previewInformationSection = this.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.previewInformationSection,
  );

  public previewAuthorContainer =
    this.previewInformationSection.getChildElementBySelector(
      AppEditorGeneralInfoPreviewSelectors.previewAuthorContainer,
    );

  public previewAuthorValue =
    this.previewAuthorContainer.getChildElementBySelector(
      AppEditorGeneralInfoPreviewSelectors.previewAuthorValue,
    );

  public topicElements = this.previewTopicsContainer.getChildElementBySelector(
    Tags.span,
  );

  public applicationDescriptionSection = this.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.description,
  );

  public descriptionParagraphs =
    this.applicationDescriptionSection.getChildElementBySelector(Tags.p);

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

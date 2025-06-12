import { Tags } from '@/src/ui/domData';
import { AppEditorGeneralInfoPreviewSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorGeneralInfoAgentPreview extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      AppEditorGeneralInfoPreviewSelectors.fullContainer,
      parentLocator,
    );
  }

  public generalInfoContainer = this.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.containerGeneralInfo,
  );

  public previewIconContainer =
    this.generalInfoContainer.getChildElementBySelector(
      AppEditorGeneralInfoPreviewSelectors.previewIconContainer,
    );

  public previewIcon = this.previewIconContainer.getChildElementBySelector(
    Tags.img,
  );

  public previewName = this.generalInfoContainer.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.previewAgentName,
  );

  public version = this.generalInfoContainer.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.version,
  );

  public previewTopicsContainer =
    this.generalInfoContainer.getChildElementBySelector(
      AppEditorGeneralInfoPreviewSelectors.previewTopicsContainer,
    );

  public previewInformationSection =
    this.generalInfoContainer.getChildElementBySelector(
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

  public applicationDescriptionSection =
    this.generalInfoContainer.getChildElementBySelector(
      AppEditorGeneralInfoPreviewSelectors.description,
    );

  public descriptionParagraphs =
    this.applicationDescriptionSection.getChildElementBySelector(Tags.p);

  public detailedSwitch = this.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.detailedSwitch,
  ).getNthElement(1);

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

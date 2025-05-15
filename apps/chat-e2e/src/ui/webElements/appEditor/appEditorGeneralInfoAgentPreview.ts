import { Tags } from '@/src/ui/domData';
import { AppEditorGeneralInfoPreviewSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorGeneralInfoAgentPreview extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(
      page,
      AppEditorGeneralInfoPreviewSelectors.containerGeneralInfo,
      parentLocator,
    );
  }

  public previewIconContainer = this.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.previewIconContainer,
  );

  public previewIcon = this.previewIconContainer.getChildElementBySelector(
    Tags.img,
  );

  public previewName = this.getChildElementBySelector(
    AppEditorGeneralInfoPreviewSelectors.previewAgentName,
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
}

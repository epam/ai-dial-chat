import { Tags } from '@/src/ui/domData';
import { ApplicationPreviewSelector } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class AppEditorPreview extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ApplicationPreviewSelector.containerGeneralInfo, parentLocator);
  }

  public previewIconContainer = this.getChildElementBySelector(
    ApplicationPreviewSelector.previewIconContainer,
  );

  public previewIcon = this.previewIconContainer.getChildElementBySelector(
    Tags.img,
  );

  public previewName = this.getChildElementBySelector(
    ApplicationPreviewSelector.previewAgentName,
  );

  public previewTopicsContainer = this.getChildElementBySelector(
    ApplicationPreviewSelector.previewTopicsContainer,
  );

  public previewInformationSection = this.getChildElementBySelector(
    ApplicationPreviewSelector.previewInformationSection,
  );

  public previewAuthorContainer =
    this.previewInformationSection.getChildElementBySelector(
      ApplicationPreviewSelector.previewAuthorContainer,
    );

  public previewAuthorValue =
    this.previewAuthorContainer.getChildElementBySelector(
      ApplicationPreviewSelector.previewAuthorValue,
    );

  public async getAppName(): Promise<string | null> {
    return this.previewName.getElementContent();
  }

  public async getAuthorName(): Promise<string | null> {
    return this.previewAuthorValue.getElementContent();
  }

  public async getTopics(): Promise<string[]> {
    const topicElements =
      this.previewTopicsContainer.getChildElementBySelector('span');
    return topicElements.getElementsInnerContent();
  }
}

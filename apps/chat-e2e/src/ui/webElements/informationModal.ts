import { IconSelectors, InformationModalSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Page } from '@playwright/test';

export class InformationModal extends BaseElement {
  constructor(page: Page) {
    super(page, InformationModalSelectors.container);
  }

  public title = this.getChildElementBySelector(
    InformationModalSelectors.title,
  );
  public lastUpdatedLabel = this.getChildElementBySelector(
    InformationModalSelectors.lastUpdatedContainer,
  ).getChildElementBySelector(InformationModalSelectors.lastUpdatedLabel);
  public lastUpdatedValue = this.getChildElementBySelector(
    InformationModalSelectors.lastUpdatedContainer,
  ).getChildElementBySelector(InformationModalSelectors.lastUpdatedValue);
  public createdDateLabel = this.getChildElementBySelector(
    InformationModalSelectors.createdDateContainer,
  ).getChildElementBySelector(InformationModalSelectors.createdDateLabel);
  public createdDateValue = this.getChildElementBySelector(
    InformationModalSelectors.createdDateContainer,
  ).getChildElementBySelector(InformationModalSelectors.createdDateValue);
  public authorLabel = this.getChildElementBySelector(
    InformationModalSelectors.authorContainer,
  ).getChildElementBySelector(InformationModalSelectors.authorLabel);
  public authorValue = this.getChildElementBySelector(
    InformationModalSelectors.authorContainer,
  ).getChildElementBySelector(InformationModalSelectors.authorValue);
  public cancelButton = this.getChildElementBySelector(
    IconSelectors.cancelIcon,
  );
}

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
  public lastUpdatedContainer = this.getChildElementBySelector(
    InformationModalSelectors.lastUpdatedContainer,
  );
  public lastUpdatedLabel = this.lastUpdatedContainer.getChildElementBySelector(
    InformationModalSelectors.lastUpdatedLabel,
  );
  public lastUpdatedValue = this.lastUpdatedContainer.getChildElementBySelector(
    InformationModalSelectors.lastUpdatedValue,
  );
  public createdDateContainer = this.getChildElementBySelector(
    InformationModalSelectors.createdDateContainer,
  );
  public createdDateLabel = this.createdDateContainer.getChildElementBySelector(
    InformationModalSelectors.createdDateLabel,
  );
  public createdDateValue = this.createdDateContainer.getChildElementBySelector(
    InformationModalSelectors.createdDateValue,
  );
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

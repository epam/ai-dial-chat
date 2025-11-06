import { IconSelectors, ReportAnIssueModalSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class ReportAnIssueModal extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(
      page,
      ReportAnIssueModalSelectors.reportAnIssueContainer,
      parentLocator,
    );
  }

  public cancelButton = this.getChildElementBySelector(
    IconSelectors.cancelIcon,
  );
}

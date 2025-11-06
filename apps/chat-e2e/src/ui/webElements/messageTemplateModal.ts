import { Tags } from '@/src/ui/domData';
import {
  ErrorLabelSelectors,
  IconSelectors,
  MessageTemplateModalSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class MessageTemplateModal extends BaseElement {
  constructor(page: Page) {
    super(page, MessageTemplateModalSelectors.messageTemplateModal);
  }

  public title = this.getChildElementBySelector(
    MessageTemplateModalSelectors.modalTitle,
  );
  public description = this.getChildElementBySelector(
    MessageTemplateModalSelectors.description,
  );
  public originalMessageLabel = this.getChildElementBySelector(
    MessageTemplateModalSelectors.originalMessageLabel,
  );
  public setTemplateTab = this.getChildElementBySelector(
    MessageTemplateModalSelectors.setTemplateTab,
  );
  public previewTab = this.getChildElementBySelector(
    MessageTemplateModalSelectors.previewTab,
  );
  public originalMessageContent = this.getChildElementBySelector(
    MessageTemplateModalSelectors.originalMessageContent,
  );
  public templateRows = this.getChildElementBySelector(
    MessageTemplateModalSelectors.templateRow,
  );
  public templatePreview = this.getChildElementBySelector(
    MessageTemplateModalSelectors.templatePreview,
  );
  public templatePreviewVar = (variable: string) =>
    this.templatePreview
      .getChildElementBySelector(Tags.span)
      .getElementLocatorByText(variable);
  public saveTemplate = this.getChildElementBySelector(
    MessageTemplateModalSelectors.saveButton,
  );
  public showMoreButton = this.getChildElementBySelector(
    MessageTemplateModalSelectors.showMoreButton,
  );
  public showLessButton = this.getChildElementBySelector(
    MessageTemplateModalSelectors.showLessButton,
  );
  cancelButton = this.getChildElementBySelector(IconSelectors.cancelIcon);
  public getFieldBottomMessage = (field: Locator) =>
    field.locator(`~${ErrorLabelSelectors.fieldError}`);

  public getTemplateRowContent = (rowContent: string | number) => {
    if (typeof rowContent === 'string') {
      return new BaseElement(
        this.page,
        `${MessageTemplateModalSelectors.templateRowContent}:text-is('${rowContent}')`,
      ).getElementLocator();
    } else {
      return this.getChildElementBySelector(
        MessageTemplateModalSelectors.templateRowContent,
      ).getNthElement(rowContent);
    }
  };

  public getTemplateRow = (rowContent: string | number) => {
    if (typeof rowContent === 'string') {
      return this.rootLocator
        .filter({ has: this.getTemplateRowContent(rowContent) })
        .first();
    } else {
      return this.templateRows.getNthElement(rowContent);
    }
  };

  public getTemplateRowValue = (rowContent: string | number) => {
    return this.getTemplateRow(rowContent).locator(
      MessageTemplateModalSelectors.templateRowValue,
    );
  };

  public getTemplateRowDeleteButton = (rowContent: string | number) => {
    return this.getTemplateRow(rowContent).locator(
      MessageTemplateModalSelectors.deleteRow,
    );
  };

  public async saveChanges() {
    const responsePromise = this.page.waitForResponse(
      (r) => r.request().method() === 'PUT',
    );
    await this.saveTemplate.click();
    await responsePromise;
  }
}

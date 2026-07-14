import { MenuSelectors, PdfPreviewModalSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Popup } from '@/src/ui/webElements/common/popup';
import { RegexUtil } from '@/src/utils';
import { Page } from '@playwright/test';

export class PdfPreviewModal extends Popup {
  constructor(page: Page) {
    super(page, PdfPreviewModalSelectors.container);
  }

  public titleContainer = this.getChildElementBySelector(
    PdfPreviewModalSelectors.title,
  );
  public title = this.titleContainer.getChildElementBySelector(
    PdfPreviewModalSelectors.titleValue,
  );
  public pagesSidebarTitle = this.getChildElementBySelector(
    PdfPreviewModalSelectors.pagesLabel,
  );
  public pagesSidebar = this.getChildElementBySelector(
    PdfPreviewModalSelectors.pagesSidebar,
  );
  public viewerContainer = this.getChildElementBySelector(
    PdfPreviewModalSelectors.viewerContainer,
  );
  public zoomSelect = this.getChildElementBySelector(
    PdfPreviewModalSelectors.zoomSelect,
  );
  public getPageThumbnail(pageNumber: number) {
    return this.getChildElementBySelector(
      PdfPreviewModalSelectors.pageThumbnail(pageNumber),
    );
  }
  public getPdfPage(pageNumber: number) {
    return this.getChildElementBySelector(
      PdfPreviewModalSelectors.pdfPage(pageNumber),
    );
  }

  public async selectZoomOption(option: string) {
    const zoomOptions = new BaseElement(this.page, MenuSelectors.menuOption);
    const escapedOptionValue = RegexUtil.escapeRegexChars(option);
    const exactMatchRegex = new RegExp(`^${escapedOptionValue}$`);
    const optionElement = zoomOptions.getElementLocatorByText(exactMatchRegex);
    await optionElement.click();
  }
}

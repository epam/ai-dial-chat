import { PdfPreviewModalSelectors } from '@/src/ui/selectors';
import { Popup } from '@/src/ui/webElements/common/popup';
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
  public getPageThumbnail(pageNumber: number) {
    return this.getChildElementBySelector(
      PdfPreviewModalSelectors.pageThumbnail(pageNumber),
    );
  }
}

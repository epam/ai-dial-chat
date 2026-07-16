import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { AttributeValues, ThemeColorAttributes } from '@/src/ui/domData';
import { PdfPreviewModal } from '@/src/ui/webElements';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { expect } from '@playwright/test';

export class PdfPreviewModalAssertion extends BaseAssertion {
  private readonly pdfPreviewModal: PdfPreviewModal;

  constructor(pdfPreviewModal: PdfPreviewModal) {
    super();
    this.pdfPreviewModal = pdfPreviewModal;
  }

  public async assertPdfPreviewModalState(expectedState: ElementState) {
    await this.assertElementState(
      this.pdfPreviewModal,
      expectedState,
      ExpectedMessages.pdfViewerIsOpened,
    );
  }

  public async assertPdfPreviewModalTitle(expectedTitle: string) {
    await this.assertElementText(
      this.pdfPreviewModal.titleContainer,
      expectedTitle,
      ExpectedMessages.pdfViewerTitleIsValid,
    );
  }

  public async assertCloseButtonAlignment() {
    const closeButton = this.pdfPreviewModal.getCloseButton();
    await this.assertElementState(closeButton, 'visible');
    await this.assertElementClass(
      closeButton,
      new RegExp(AttributeValues.absolute),
    );
    await this.assertElementClass(
      closeButton,
      new RegExp(AttributeValues.end2),
    );
  }

  public async assertTitleAlignment() {
    const title = this.pdfPreviewModal.titleContainer;
    await this.assertElementState(title, 'visible');
    await this.assertElementClass(title, new RegExp(AttributeValues.textStart));
  }

  public async assertPagesSidebarState(expectedState: ElementState) {
    await this.assertElementState(
      this.pdfPreviewModal.pagesSidebarTitle,
      expectedState,
      ExpectedMessages.pdfViewerPagesSidebarTitleIsValid,
    );
    await this.assertElementState(
      this.pdfPreviewModal.pagesSidebar,
      expectedState,
    );
  }

  public async assertPagesSidebarIsScrollable() {
    await this.assertElementClass(
      this.pdfPreviewModal.pagesSidebar,
      new RegExp(AttributeValues.overflowYAuto),
      ExpectedMessages.pdfViewerPagesSidebarIsScrollable,
    );
  }

  public async assertPageThumbnailState(
    pageNumber: number,
    expectedState: ElementState,
  ) {
    await this.assertElementState(
      this.pdfPreviewModal.getPageThumbnail(pageNumber),
      expectedState,
    );
  }

  public async assertPageThumbnailSelectedState(pageNumber: number) {
    await this.assertElementBorderColors(
      this.pdfPreviewModal.getPageThumbnail(pageNumber),
      ThemesUtil.getRgbColorByKey(ThemeColorAttributes.strokePrimary),
    );
  }

  public async assertZoomSelectValue(expectedValue: string) {
    await this.assertElementContainsText(
      this.pdfPreviewModal.zoomSelect,
      expectedValue,
      ExpectedMessages.pdfViewerZoomLevelIsValid,
    );
  }

  public async assertViewerHorizontalScrollState(expectedState: ElementState) {
    const hasHorizontalScroll =
      await this.pdfPreviewModal.viewerContainer.isElementWidthTruncated();
    expectedState === 'visible'
      ? expect
          .soft(hasHorizontalScroll, ExpectedMessages.horizontalScrollIsVisible)
          .toBeTruthy()
      : expect
          .soft(
            hasHorizontalScroll,
            ExpectedMessages.horizontalScrollIsNotVisible,
          )
          .toBeFalsy();
  }

  public async assertViewerVerticalScrollState(expectedState: ElementState) {
    const hasVerticalScroll =
      await this.pdfPreviewModal.viewerContainer.isElementScrollableVertically();
    expectedState === 'visible'
      ? expect
          .soft(hasVerticalScroll, ExpectedMessages.verticalScrollIsVisible)
          .toBeTruthy()
      : expect
          .soft(hasVerticalScroll, ExpectedMessages.verticalScrollIsNotVisible)
          .toBeFalsy();
  }

  public async assertPageZoomedProportionally(
    pageNumber: number,
    baseWidth: number,
    baseZoomRatio: number,
    targetZoomRatio: number,
  ) {
    const pageBox = await this.pdfPreviewModal
      .getPdfPage(pageNumber)
      .getElementBoundingBox();
    const expectedWidth = (baseWidth / baseZoomRatio) * targetZoomRatio;
    const tolerance = expectedWidth * 0.05;
    expect
      .soft(pageBox!.width, ExpectedMessages.pdfViewerPageZoomSizeIsValid)
      .toBeGreaterThanOrEqual(expectedWidth - tolerance);
    expect
      .soft(pageBox!.width, ExpectedMessages.pdfViewerPageZoomSizeIsValid)
      .toBeLessThanOrEqual(expectedWidth + tolerance);
  }
}

import { Attributes, Tags } from '@/src/ui/domData';
import { SliderDotsSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

// Dots pagination of a SliderGrid: one dot per page plus the prev/next arrows.
// Only about 7 dots fit the strip and the rest are clipped by its overflow, so a
// dot can be clicked only when it sits next to the active one. Distant pages are
// reachable the way a user reaches them - with the arrows.
export class SliderDots extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, SliderDotsSelectors.container, parentLocator);
  }

  private dotsList = this.getChildElementBySelector(
    SliderDotsSelectors.dotsList,
  );

  public nextArrow = this.getChildElementBySelector(
    SliderDotsSelectors.nextArrow,
  );
  public previousArrow = this.getChildElementBySelector(
    SliderDotsSelectors.previousArrow,
  );
  public dots = this.dotsList.getChildElementBySelector(
    SliderDotsSelectors.dot,
  );
  public activeDot = this.dotsList.getChildElementBySelector(
    SliderDotsSelectors.activeDot,
  );

  // Pages are 0-based, same as the component's activeSlide.
  public getDot(pageIndex: number): BaseElement {
    return this.dotsList.getChildElementBySelector(
      SliderDotsSelectors.dotByIndex(pageIndex),
    );
  }

  // The clickable circle/bar itself; the dot's data-qa sits on its wrapper.
  public getDotButton(pageIndex: number): BaseElement {
    return this.getDot(pageIndex).getChildElementBySelector(Tags.button);
  }

  public async getPagesCount(): Promise<number> {
    return this.dots.getElementsCount();
  }

  public async getActivePageIndex(): Promise<number> {
    const dotQa = await this.activeDot.getAttribute(Attributes.dataQA);
    return dotQa ? +dotQa.replace(SliderDotsSelectors.dotQaPrefix, '') : -1;
  }

  public async openNextPageByDot() {
    const activePage = await this.getActivePageIndex();
    await this.getDot(activePage + 1).click();
  }

  public async openPreviousPageByDot() {
    const activePage = await this.getActivePageIndex();
    await this.getDot(activePage - 1).click();
  }

  public async goToLastPage() {
    while (await this.nextArrow.isElementEnabled()) {
      await this.nextArrow.click();
    }
  }
}

import { Attributes, Tags } from '@/src/ui/domData';
import { SliderDotsSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

// Dots pagination of a SliderGrid: one dot per page plus the prev/next arrows.
export class SliderDots extends BaseElement {
  constructor(page: Page, parentLocator?: Locator) {
    super(page, SliderDotsSelectors.container, parentLocator);
  }

  public nextArrow = this.getChildElementBySelector(
    SliderDotsSelectors.nextArrow,
  );
  public previousArrow = this.getChildElementBySelector(
    SliderDotsSelectors.previousArrow,
  );
  public dots = this.getChildElementBySelector(
    SliderDotsSelectors.dotsList,
  ).getChildElementBySelector(SliderDotsSelectors.dot);

  // Pages are 0-based, same as the component's activeSlide.
  public getDot(pageIndex: number): BaseElement {
    return this.getChildElementBySelector(
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

  // The active page is a bar (w-8), the others stay circles.
  public async getActivePageIndex(): Promise<number> {
    const pagesCount = await this.getPagesCount();
    for (let pageIndex = 0; pageIndex < pagesCount; pageIndex++) {
      const dotClass = await this.getDotButton(pageIndex).getAttribute(
        Attributes.class,
      );
      if (dotClass?.includes(SliderDotsSelectors.activeDotClass)) {
        return pageIndex;
      }
    }
    return -1;
  }

  public async openPage(pageIndex: number) {
    await this.getDot(pageIndex).click();
  }
}

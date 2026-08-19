import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { SliderDots } from '@/src/ui/webElements/common/sliderDots';

export class SliderDotsAssertion extends BaseAssertion {
  private readonly sliderDots: SliderDots;

  constructor(sliderDots: SliderDots) {
    super();
    this.sliderDots = sliderDots;
  }

  public async assertPagesCount(expectedCount: number) {
    await this.assertElementsCount(
      this.sliderDots.dots,
      expectedCount,
      ExpectedMessages.sliderPagesCountIsValid,
    );
  }

  public async assertPagesCountIsGreaterThan(expectedCount: number) {
    this.assertNumberIsGreaterThan(
      await this.sliderDots.getPagesCount(),
      expectedCount,
      ExpectedMessages.sliderPagesCountIsValid,
    );
  }

  public async assertActivePage(expectedPageIndex: number) {
    this.assertValue(
      await this.sliderDots.getActivePageIndex(),
      expectedPageIndex,
      ExpectedMessages.sliderActivePageIsValid,
    );
  }

  // Everything is hidden when all the items fit one page.
  public async assertSliderIsHidden() {
    await this.assertElementState(this.sliderDots.dots, 'hidden');
    await this.assertElementState(this.sliderDots.nextArrow, 'hidden');
    await this.assertElementState(this.sliderDots.previousArrow, 'hidden');
  }
}

import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
import { Tooltip } from '@/src/ui/webElements/tooltip';
import { expect } from '@playwright/test';

export class TooltipAssertion extends BaseAssertion {
  readonly tooltip: Tooltip;

  constructor(tooltip: Tooltip) {
    super();
    this.tooltip = tooltip;
  }

  public async assertTooltipContent(expectedContent: string) {
    expect
      .soft(
        await this.tooltip.getContent(),
        ExpectedMessages.tooltipContentIsValid,
      )
      .toBe(expectedContent);
  }

  public async assertTooltipContains(expectedContent: string | RegExp) {
    await this.assertElementContainsText(
      this.tooltip,
      expectedContent,
      ExpectedMessages.tooltipContentIsValid,
    );
  }

  public async assertTooltipStyle(property: string, value: string) {
    await expect(
      this.tooltip.getElementLocator(),
      `Element style property: ${property} is valid`,
    ).toHaveCSS(property, value);
  }

  public async assertTooltipState(expectedState: ElementState) {
    await this.assertElementState(
      this.tooltip,
      expectedState,
      expectedState === 'visible'
        ? ExpectedMessages.tooltipIsVisible
        : ExpectedMessages.tooltipIsHidden,
    );
  }
}

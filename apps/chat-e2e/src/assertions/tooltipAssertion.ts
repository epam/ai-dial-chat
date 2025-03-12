import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
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

  public async assertTooltipStyle(property: string, value: string) {
    const tooltipStyle = await this.tooltip.getComputedStyleProperty(property);
    expect
      .soft(tooltipStyle[0], ExpectedMessages.promptVarLabelIsFullyVisible)
      .toBe(value);
  }
}

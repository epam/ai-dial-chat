import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { TooltipPortal } from '@/src/ui/webElements';

export class TooltipPortalAssertion extends BaseAssertion {
  readonly tooltipPortal: TooltipPortal;

  constructor(tooltipPortal: TooltipPortal) {
    super();
    this.tooltipPortal = tooltipPortal;
  }

  public async assertTooltipContent(
    expectedContent: string,
    expectedMessage?: string,
  ) {
    await this.assertElementText(
      this.tooltipPortal,
      expectedContent,
      expectedMessage ?? ExpectedMessages.tooltipContentIsValid,
    );
  }
}

import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ModelInfoTooltip } from '@/src/ui/webElements';

export class ConversationInfoTooltipAssertion extends BaseAssertion {
  readonly modelInfoTooltip: ModelInfoTooltip;

  constructor(modelInfoTooltip: ModelInfoTooltip) {
    super();
    this.modelInfoTooltip = modelInfoTooltip;
  }

  public async assertTooltipModelIcon(expectedIcon: string) {
    await super.assertEntityIcon(
      this.modelInfoTooltip.getModelIcon(),
      expectedIcon,
    );
  }
}

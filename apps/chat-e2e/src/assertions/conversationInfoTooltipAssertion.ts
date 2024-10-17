import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { ChatInfoTooltip } from '@/src/ui/webElements';

export class ConversationInfoTooltipAssertion extends BaseAssertion {
  readonly chatInfoTooltip: ChatInfoTooltip;

  constructor(chatInfoTooltip: ChatInfoTooltip) {
    super();
    this.chatInfoTooltip = chatInfoTooltip;
  }

  public async assertTooltipModelIcon(expectedIcon: string) {
    await super.assertEntityIcon(
      this.chatInfoTooltip.getModelIcon(),
      expectedIcon,
    );
  }
}

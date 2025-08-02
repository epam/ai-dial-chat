import { DialAIEntityModel } from '@/chat/types/models';
import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, MarketplaceExpectedMessages } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { TalkToAgentDialog } from '@/src/ui/webElements/talkToAgentDialog';

export class TalkToAgentDialogAssertion extends BaseAssertion {
  readonly talkToAgentDialog: TalkToAgentDialog;

  constructor(talkToAgentDialog: TalkToAgentDialog) {
    super();
    this.talkToAgentDialog = talkToAgentDialog;
  }

  public async assertAgentIsSelected(
    expectedAgent: DialAIEntityModel | string,
  ) {
    const agent = this.talkToAgentDialog.getAgents().getAgent(expectedAgent);
    await this.assertElementAttribute(agent, Attributes.ariaSelected, 'true');
  }

  public async assertAgentState(
    agent: DialAIEntityModel | string,
    expectedState: ElementState,
  ) {
    await super.assertElementState(
      this.talkToAgentDialog.getTalkToAgent(agent),
      expectedState,
      MarketplaceExpectedMessages.agentIsVisible(
        typeof agent === 'string' ? agent : agent.name,
      ),
    );
  }
}

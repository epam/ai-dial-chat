import { DialAIEntityModel } from '@/chat/types/models';
import { AgentsBrowserModalAssertion } from '@/src/assertions/agentsBrowserModalAssertion';
import { ElementState, MarketplaceExpectedMessages } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { TalkToAgentDialog } from '@/src/ui/webElements/talkToAgentDialog';

export class TalkToAgentDialogAssertion extends AgentsBrowserModalAssertion<TalkToAgentDialog> {
  constructor(talkToAgentDialog: TalkToAgentDialog) {
    super(talkToAgentDialog);
  }

  public async assertAgentIsSelected(
    expectedAgent: DialAIEntityModel | string,
  ) {
    const agent = this.agentsBrowserModal.getAgents().getEntity(expectedAgent);
    await this.assertElementAttribute(agent, Attributes.ariaSelected, 'true');
  }

  public async assertAgentState(
    agent: DialAIEntityModel | string,
    expectedState: ElementState,
  ) {
    await super.assertElementState(
      this.agentsBrowserModal.getTalkToAgent(agent),
      expectedState,
      MarketplaceExpectedMessages.agentIsVisible(
        typeof agent === 'string' ? agent : agent.name,
      ),
    );
  }
}

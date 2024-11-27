import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { AgentInfo } from '@/src/ui/webElements';

export class AgentInfoAssertion extends BaseAssertion {
  readonly agentInfo: AgentInfo;

  constructor(agentInfo: AgentInfo) {
    super();
    this.agentInfo = agentInfo;
  }

  public async assertModelIcon(expectedIcon: string) {
    await super.assertEntityIcon(
      await this.agentInfo.getAgentIcon(),
      expectedIcon,
    );
  }
}

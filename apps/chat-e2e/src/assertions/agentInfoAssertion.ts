import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { AgentInfo } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class AgentInfoAssertion extends BaseAssertion {
  readonly agentInfo: AgentInfo;

  constructor(agentInfo: AgentInfo) {
    super();
    this.agentInfo = agentInfo;
  }

  public async assertAgentIcon(expectedIcon: string) {
    await super.assertEntityIcon(
      await this.agentInfo.getAgentIcon(),
      expectedIcon,
    );
  }

  public async assertDescription(expectedDescription?: string) {
    const description = await this.agentInfo.getAgentDescription();
    expect
      .soft(description, ExpectedMessages.agentDescriptionIsValid)
      .toBe(expectedDescription ?? '');
  }
}

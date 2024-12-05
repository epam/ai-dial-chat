import { DialAIEntityModel } from '@/chat/types/models';
import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { TalkToAgentDialog } from '@/src/ui/webElements/talkToAgentDialog';
import { expect } from '@playwright/test';

export class TalkToAgentDialogAssertion extends BaseAssertion {
  readonly talkToAgentDialog: TalkToAgentDialog;

  constructor(talkToAgentDialog: TalkToAgentDialog) {
    super();
    this.talkToAgentDialog = talkToAgentDialog;
  }

  public async assertAgentIsSelected(
    expectedAgent: DialAIEntityModel | string,
  ) {
    expect
      .soft(
        await this.talkToAgentDialog.getAgents().getSelectedAgent(),
        ExpectedMessages.talkToEntityIsSelected,
      )
      .toBe(
        typeof expectedAgent === 'string' ? expectedAgent : expectedAgent.name,
      );
  }
}

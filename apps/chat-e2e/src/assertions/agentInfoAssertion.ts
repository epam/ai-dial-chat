import { DialAIEntityModel } from '@/chat/types/models';
import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { AgentInfo } from '@/src/ui/webElements';
import { decode } from 'he';

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

  public async assertShortDescription(
    expectedModel: DialAIEntityModel | string,
  ) {
    if (typeof expectedModel === 'string') {
      await this.assertElementText(
        this.agentInfo.agentDescription,
        expectedModel,
        ExpectedMessages.agentDescriptionIsValid,
      );
    } else {
      if (expectedModel.description) {
        const rawDescription =
          expectedModel.description.split(/\s*\n\s*\n\s*/g)[0] ?? '';
        let expectedText = rawDescription;
        if (rawDescription.includes('<') && rawDescription.includes('>')) {
          expectedText = rawDescription
            .replaceAll(/'/g, '"')
            .replaceAll(/">/g, ';">')
            .replaceAll(/:(?=\S)/g, ': ');
        }
        const actualHtml =
          await this.agentInfo.agentDescription.getElementsInnerHtml();
        this.assertValue(
          decode(actualHtml),
          expectedText,
          ExpectedMessages.agentDescriptionIsValid,
        );
      } else {
        await this.assertElementState(
          this.agentInfo.agentDescription,
          'hidden',
        );
      }
    }
  }

  public async assertAgentName(expectedName: string) {
    await this.assertElementText(
      this.agentInfo.agentName,
      expectedName,
      ExpectedMessages.agentNameIsValid,
    );
  }

  public async assertAgentVersion(expectedVersion: string | undefined) {
    const versionElement = this.agentInfo.agentVersion;
    expectedVersion
      ? await this.assertElementText(
          this.agentInfo.agentVersion,
          expectedVersion,
          ExpectedMessages.agentVersionIsValid,
        )
      : await this.assertElementState(versionElement, 'hidden');
  }
}

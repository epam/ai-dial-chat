import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState } from '@/src/testData';
import { AgentsBrowserModal } from '@/src/ui/webElements/agentsBrowserModal';
import { BaseElement } from '@/src/ui/webElements/baseElement';

// Base for the agents/toolsets picker assertions (search, tabs, entity grid).
// TalkToAgentDialogAssertion and AgentAndToolsetSelectModalAssertion extend it.
export class AgentsBrowserModalAssertion<
  T extends AgentsBrowserModal,
> extends BaseAssertion {
  readonly agentsBrowserModal: T;

  constructor(agentsBrowserModal: T) {
    super();
    this.agentsBrowserModal = agentsBrowserModal;
  }

  public async assertTabIsActive(tab: BaseElement) {
    await this.assertElementState(
      this.agentsBrowserModal.getActiveTab(tab),
      'visible',
    );
  }

  // Search the current tab for each name and assert the entity is present/absent.
  public async assertEntitiesState(names: string[], state: ElementState) {
    for (const name of names) {
      const entity = await this.agentsBrowserModal.searchForEntity(name);
      await this.assertElementState(entity, state);
    }
  }
}

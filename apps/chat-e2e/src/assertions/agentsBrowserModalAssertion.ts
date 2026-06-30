import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState } from '@/src/testData';
import { ChatSettingsSelectors } from '@/src/ui/selectors';
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

  // A tab is active when it also carries the accent-border class.
  public async assertTabIsActive(tab: BaseElement) {
    const tabLocator = tab.getElementLocator();
    await this.assertElementState(
      tabLocator.and(
        tabLocator.page().locator(ChatSettingsSelectors.selectedTalkToEntity),
      ),
      'visible',
    );
  }

  // Search the current tab for each name and assert the entity is present/absent.
  public async assertEntitiesState(names: string[], state: ElementState) {
    for (const name of names) {
      await this.agentsBrowserModal.searchInput.fillInInput(name);
      await this.assertElementState(
        this.agentsBrowserModal.getEntityByName(name),
        state,
      );
    }
  }
}

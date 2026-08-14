import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ElementState, ExpectedMessages } from '@/src/testData';
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

  // Names are collected across all the slider pages, so it works with a grid
  // that holds more items than one page fits.
  public async assertAllEntityNamesInclude(names: string[]) {
    const displayedNames = await this.agentsBrowserModal.getAllEntityNames();
    for (const name of names) {
      this.assertArrayIncludes(
        displayedNames,
        name,
        ExpectedMessages.searchResultsAreCorrect,
      );
    }
  }

  // The grid shows something - used when the exact content is not predictable.
  public async assertGridIsNotEmpty() {
    this.assertNumberIsGreaterThan(
      await this.agentsBrowserModal.getEntities().getElementsCount(),
      0,
      ExpectedMessages.searchResultCountIsValid,
    );
  }

  // What the grid currently holds — the search input is left untouched.
  public async assertDisplayedEntities(names: {
    visible?: string[];
    hidden?: string[];
  }) {
    for (const name of names.visible ?? []) {
      await this.assertElementState(
        this.agentsBrowserModal.getEntityByName(name),
        'visible',
      );
    }
    for (const name of names.hidden ?? []) {
      await this.assertElementState(
        this.agentsBrowserModal.getEntityByName(name),
        'hidden',
      );
    }
  }
}

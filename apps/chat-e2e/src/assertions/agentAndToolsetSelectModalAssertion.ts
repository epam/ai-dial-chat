import { AgentsBrowserModalAssertion } from '@/src/assertions/agentsBrowserModalAssertion';
import { AgentAndToolsetSelectModal } from '@/src/ui/webElements/entityEditor/quickApp2/agentAndToolsetSelectModal';

export class AgentAndToolsetSelectModalAssertion extends AgentsBrowserModalAssertion<AgentAndToolsetSelectModal> {
  constructor(agentAndToolsetSelectModal: AgentAndToolsetSelectModal) {
    super(agentAndToolsetSelectModal);
  }

  // Each given item shows up as a chip in the "Selected" section.
  public async assertSelected(names: string[]) {
    for (const name of names) {
      await this.assertElementState(
        this.agentsBrowserModal.getSelectedChipByName(name),
        'visible',
      );
    }
  }

  // The "Selected" section has no chips.
  public async assertNothingSelected() {
    await this.assertElementState(
      this.agentsBrowserModal.selectedChips,
      'hidden',
    );
  }
}

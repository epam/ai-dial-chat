import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { AgentsBrowserModal } from '@/src/ui/webElements/agentsBrowserModal';

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
}

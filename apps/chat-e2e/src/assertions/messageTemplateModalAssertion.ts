import { BaseAssertion } from '@/src/assertions/baseAssertion';
import { MessageTemplateModal } from '@/src/ui/webElements';

export class MessageTemplateModalAssertion extends BaseAssertion {
  readonly messageTemplateModal: MessageTemplateModal;

  constructor(messageTemplateModal: MessageTemplateModal) {
    super();
    this.messageTemplateModal = messageTemplateModal;
  }
}

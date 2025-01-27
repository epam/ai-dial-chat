import { PromptPreviewModalAssertion } from '@/src/assertions/promptPreviewModalAssertion';
import { PublishedPromptPreviewModal } from '@/src/ui/webElements/publishedPromptPreviewModal';

export class PublishedPromptPreviewModalAssertion extends PromptPreviewModalAssertion {
  readonly publishedPromptPreviewModal: PublishedPromptPreviewModal;

  constructor(publishedPromptPreviewModal: PublishedPromptPreviewModal) {
    super(publishedPromptPreviewModal);
    this.publishedPromptPreviewModal = publishedPromptPreviewModal;
  }

  // Add assertions specific to PublishedPromptPreviewModal here
}

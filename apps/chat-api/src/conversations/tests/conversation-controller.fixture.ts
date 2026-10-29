import type { ConversationGenerationService } from '../conversation-generation.service';
import { ConversationController } from '../conversation.controller';
import type { ConversationService } from '../conversation.service';
import { ConversationCompletionsResponder } from '../streaming/conversation-completions.responder';

/**
 * Builds a `ConversationController` outside Nest, wiring the completions
 * responder to the same service and generation doubles the test passes.
 */
export const createConversationController = (
  conversationService: unknown,
  generationService: unknown,
): ConversationController =>
  new ConversationController(
    conversationService as ConversationService,
    new ConversationCompletionsResponder(
      conversationService as ConversationService,
      generationService as ConversationGenerationService,
    ),
  );

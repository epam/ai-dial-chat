import { ConversationGenerationController } from '../conversation-generation.controller';
import type { ConversationGenerationService } from '../conversation-generation.service';
import { ConversationWatchController } from '../conversation-watch.controller';
import type { ConversationService } from '../conversation.service';
import { ConversationCompletionsResponder } from '../streaming/conversation-completions.responder';

/**
 * Builds a `ConversationGenerationController` outside Nest, wiring the
 * completions responder to the same service and generation doubles the test
 * passes.
 */
export const createConversationGenerationController = (
  conversationService: unknown,
  generationService: unknown,
): ConversationGenerationController =>
  new ConversationGenerationController(
    new ConversationCompletionsResponder(
      conversationService as ConversationService,
      generationService as ConversationGenerationService,
    ),
  );

/** Builds a `ConversationWatchController` outside Nest over a service double. */
export const createConversationWatchController = (
  conversationService: unknown,
): ConversationWatchController =>
  new ConversationWatchController(conversationService as ConversationService);

import { ForbiddenException, type Logger } from '@nestjs/common';
import type { DeploymentsService } from '../../deployments/deployments.service';
import { ConversationErrorCode } from '../types/conversation-error-code.enum';

/** The fields of a stored conversation that name the model it uses now. */
interface ConversationModelFields {
  assistantModelId?: string;
  model?: { id?: string };
}

/** The model a conversation uses now — not the one encoded in its path, which keeps the model it was created with. */
export const getConversationModelId = (
  conversation: ConversationModelFields,
): string | undefined =>
  conversation.assistantModelId || conversation.model?.id;

/**
 * Refuses an action that would put a model hidden through
 * `HIDDEN_ENTITY_TAGS` back to work — sending to it, or sharing or publishing
 * a conversation that uses it (issue #9183).
 *
 * @throws {ForbiddenException} `code: conversationModelHidden` when `modelId` resolves to a hidden deployment
 */
export const assertModelNotHidden = async (
  deploymentsService: DeploymentsService,
  modelId: string | undefined,
  token: string,
  bucket: string,
  logger: Logger,
  action: string,
): Promise<void> => {
  if (!modelId) return;
  const deployment = await deploymentsService.resolveDeploymentItem(
    modelId,
    token,
    bucket,
  );
  if (!deployment?.isHidden) return;
  logger.warn(`Refusing to ${action}: model "${modelId}" is hidden`);
  throw new ForbiddenException({
    statusCode: 403,
    error: 'Forbidden',
    code: ConversationErrorCode.ModelHidden,
    message: 'The conversation model is no longer available',
  });
};

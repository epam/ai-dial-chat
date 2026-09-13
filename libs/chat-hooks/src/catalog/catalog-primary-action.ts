import type { CatalogItem } from '@epam/ai-dial-catalog';
import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  CatalogEntityType,
  extractPromptParams,
} from '@epam/ai-dial-chat-shared';

/** Discriminant for primary-action result variants. */
export enum CatalogPrimaryActionType {
  Deployment = 'deployment',
  Prompt = 'prompt',
}

/** Primary action resolved for a deployment (model, agent, toolset, or skill). */
export interface CatalogPrimaryActionDeployment {
  /** Discriminant. */
  kind: CatalogPrimaryActionType.Deployment;
  /** Deployment entity id. */
  id: string;
}

/** Primary action resolved for a prompt. */
export interface CatalogPrimaryActionPrompt {
  /** Discriminant. */
  kind: CatalogPrimaryActionType.Prompt;
  /** Prompt entity id. */
  id: string;
  /** Display name of the prompt. */
  name: string;
  /** Short description of the prompt. */
  description: string;
  /** Resolved prompt body (seeded from details or fetched). */
  content: string;
  /** Whether the prompt body contains at least one `{{parameter}}` placeholder. */
  hasParameters: boolean;
}

/** Discriminated union of catalog primary-action results. */
export type CatalogPrimaryActionResult =
  | CatalogPrimaryActionDeployment
  | CatalogPrimaryActionPrompt;

/**
 * Resolves the primary action for a catalog item.
 *
 * For prompts: prefers already-seeded content from `item.details`; otherwise
 * calls `fetchPrompt` once to retrieve the body. Sets `hasParameters` based on
 * whether the content contains prompt-parameter placeholders.
 *
 * For all other entity types: returns a deployment result with the item id.
 *
 * The function does not navigate, select a deployment, show notifications, or
 * import route constants — those remain the caller's responsibility.
 *
 * @throws When `fetchPrompt` rejects (propagated to the caller without wrapping).
 */
export const resolveCatalogPrimaryAction = async (
  item: CatalogItem,
  fetchPrompt: (item: CatalogItem) => Promise<PromptResponseDto>,
): Promise<CatalogPrimaryActionResult> => {
  if (item.type !== CatalogEntityType.Prompt) {
    return { kind: CatalogPrimaryActionType.Deployment, id: item.id };
  }

  let content = item.details?.promptContent?.content;
  if (content == null) {
    const dto = await fetchPrompt(item);
    content = dto.content;
  }

  return {
    kind: CatalogPrimaryActionType.Prompt,
    id: item.id,
    name: item.name,
    description: item.description,
    content,
    hasParameters: extractPromptParams(content).length > 0,
  };
};

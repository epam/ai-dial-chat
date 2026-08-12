import type { PublishRuleDto } from '@epam/ai-dial-chat-api-client';
import type {
  PublicationRule,
  PublicationRuleFunction,
} from '@epam/ai-dial-publish-panel';
import { publishApi } from './api-client';

/** Converts a `PublicationRule` (publish-panel lib model) to the generated client's `PublishRuleDto` shape. */
export const toPublishRuleDto = (rule: PublicationRule): PublishRuleDto => ({
  source: rule.source,
  targets: rule.targets,
  function: rule.function as unknown as PublishRuleDto['function'],
});

/** Fetches the destination folder's already-configured access rules, shared by the conversation and catalog publish flows. */
export const getPublishRules = async (
  folderPath: string,
): Promise<PublicationRule[]> => {
  const response = await publishApi.getPublishRules({ folderPath });
  return response.rules.map(({ function: ruleFunction, ...rule }) => ({
    ...rule,
    function: ruleFunction as unknown as PublicationRuleFunction,
  }));
};

import type {
  PublicationRule,
  PublicationRuleFunction,
} from '@epam/ai-dial-publish-panel';
import { publishApi } from './api-client';

/** Fetches the destination folder's already-configured access rules, shared by the conversation and catalog publish flows. */
export const getPublishRules = async (
  folderPath: string,
): Promise<PublicationRule[]> => {
  const response = await publishApi.getPublishRules({ folderPath });
  return response.rules.map((rule) => ({
    ...rule,
    function: rule.function as unknown as PublicationRuleFunction,
  }));
};

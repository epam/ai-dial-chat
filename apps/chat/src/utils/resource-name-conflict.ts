import {
  getResourceNameConflictKind,
  ResourceNameConflictKind,
} from '@epam/ai-dial-chat-hooks';
import { AppsEditorI18nKeys } from '../constants/translation-keys';

/** Translation key of the message naming each kind of entity that can already hold a name and version. */
export const RESOURCE_NAME_CONFLICT_KEYS: Record<
  ResourceNameConflictKind,
  AppsEditorI18nKeys
> = {
  [ResourceNameConflictKind.Agent]: AppsEditorI18nKeys.ErrorNameConflictAgent,
  [ResourceNameConflictKind.Toolset]:
    AppsEditorI18nKeys.ErrorNameConflictToolset,
};

/**
 * Returns the message key for a duplicate-name `409`, or `undefined` for any other failure.
 * @param error - the rejection of a generated-client call
 */
export const getResourceNameConflictKey = async (
  error: unknown,
): Promise<AppsEditorI18nKeys | undefined> => {
  const kind = await getResourceNameConflictKind(error);
  return kind == null ? undefined : RESOURCE_NAME_CONFLICT_KEYS[kind];
};

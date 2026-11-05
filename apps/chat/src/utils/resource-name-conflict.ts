import { ResourceNameConflictCode } from '@epam/ai-dial-chat-api-client';
import {
  ResourceSaveError,
  getApiErrorDetails,
  isResourceCreateAdapter,
  type ResourceSaveAdapter,
} from '@epam/ai-dial-chat-hooks';
import { AppsEditorI18nKeys } from '../constants/translation-keys';

const CONFLICT_MESSAGE_KEYS: Record<
  ResourceNameConflictCode,
  AppsEditorI18nKeys
> = {
  [ResourceNameConflictCode.NameTakenAgent]:
    AppsEditorI18nKeys.ErrorNameConflictAgent,
  [ResourceNameConflictCode.NameTakenToolset]:
    AppsEditorI18nKeys.ErrorNameConflictToolset,
};

/**
 * Returns the translation key naming the entity that already holds the
 * displayed name and version when `error` is the `409` the toolset and
 * application writes answer for a duplicate, and `undefined` for any other
 * failure (including a `409` without that code).
 * @param error - the rejection of a generated-client call
 */
export const getResourceNameConflictKey = async (
  error: unknown,
): Promise<AppsEditorI18nKeys | undefined> => {
  const { status, code } = await getApiErrorDetails(error);
  if (status !== 409 || code == null) return undefined;
  return CONFLICT_MESSAGE_KEYS[code as ResourceNameConflictCode];
};

/**
 * Wraps the write steps of a Save panel adapter so a duplicate rejection
 * reaches the panel as a `ResourceSaveError` carrying the translated message.
 * The panel keeps itself open and shows a `ResourceSaveError` inline, whereas
 * it would show its generic "version already exists" text for any other `409`
 * of a new-version write. Moving a saved resource is left alone: its failure
 * already has its own "saved, but not moved" outcome.
 * @param adapter - the editor's Save panel adapter
 * @param translate - resolves a translation key to the user's language
 */
export const withResourceNameConflictMessages = (
  adapter: ResourceSaveAdapter,
  translate: (key: AppsEditorI18nKeys) => string,
): ResourceSaveAdapter => {
  const guard =
    <Args extends unknown[], Result>(
      operation: (...args: Args) => Promise<Result>,
    ) =>
    async (...args: Args): Promise<Result> => {
      try {
        return await operation(...args);
      } catch (error) {
        const key = await getResourceNameConflictKey(error);
        if (key != null) throw new ResourceSaveError(translate(key));
        throw error;
      }
    };

  if (isResourceCreateAdapter(adapter)) {
    return { ...adapter, createIn: guard(adapter.createIn) };
  }
  return {
    ...adapter,
    saveInPlace: guard(adapter.saveInPlace),
    ...(adapter.saveAsNewVersion && {
      saveAsNewVersion: guard(adapter.saveAsNewVersion),
    }),
  };
};

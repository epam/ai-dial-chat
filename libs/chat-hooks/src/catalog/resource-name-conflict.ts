import { ResourceNameConflictCode } from '@epam/ai-dial-chat-api-client';
import { getApiErrorDetails } from '../api-error/api-error';
import {
  isResourceCreateAdapter,
  ResourceSaveError,
  type ResourceSaveAdapter,
} from './resource-save-adapter';

/** The kind of entity that already holds a displayed name and version a write asked for. */
export enum ResourceNameConflictKind {
  /** An application shown as an agent. */
  Agent = 'agent',
  /** A toolset resource. */
  Toolset = 'toolset',
}

/** The translated message for each kind of entity a duplicate can collide with. */
export type ResourceNameConflictMessages = Record<
  ResourceNameConflictKind,
  string
>;

const CONFLICT_KINDS: Record<
  ResourceNameConflictCode,
  ResourceNameConflictKind
> = {
  [ResourceNameConflictCode.NameTakenAgent]: ResourceNameConflictKind.Agent,
  [ResourceNameConflictCode.NameTakenToolset]: ResourceNameConflictKind.Toolset,
};

/**
 * Returns the kind of entity holding the requested name and version when `error` is a duplicate `409`, otherwise `undefined`.
 * @param error - the rejection of a generated-client call
 */
export const getResourceNameConflictKind = async (
  error: unknown,
): Promise<ResourceNameConflictKind | undefined> => {
  const { status, code } = await getApiErrorDetails(error);
  if (status !== 409 || code == null) return undefined;
  return CONFLICT_KINDS[code as ResourceNameConflictCode];
};

/**
 * Returns `adapter` with its create, in-place and new-version steps rejecting a duplicate `409` as a `ResourceSaveError` carrying the matching message.
 * @param adapter - the editor's Save panel adapter
 * @param messages - the translated message for each kind of conflicting entity
 */
export const withResourceNameConflictMessages = (
  adapter: ResourceSaveAdapter,
  messages: ResourceNameConflictMessages,
): ResourceSaveAdapter => {
  /*
   * The panel renders a thrown ResourceSaveError inline and stays open, but
   * for any other 409 of a new-version write it shows its generic "version
   * already exists" text. Moving a saved resource is left unwrapped: its
   * failure already has its own "saved, but not moved" outcome.
   */
  const guard =
    <Args extends unknown[], Result>(
      operation: (...args: Args) => Promise<Result>,
    ) =>
    async (...args: Args): Promise<Result> => {
      try {
        return await operation(...args);
      } catch (error) {
        const kind = await getResourceNameConflictKind(error);
        if (kind != null) throw new ResourceSaveError(messages[kind]);
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

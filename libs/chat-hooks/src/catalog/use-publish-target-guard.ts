import { useCallback, useMemo } from 'react';
import type { PublishApiClient } from './create-publish-api';
import type { CatalogPublishEntityType } from './publish';
import {
  PublishTargetTakenError,
  wrapPublishTargetTaken,
} from './publish-target-taken';

/** The catalog entity a published item stands for. */
export interface PublishTargetEntity {
  /** Catalog entity kind. */
  entityType: CatalogPublishEntityType;
  /** Resource id of the entity. */
  entityId: string;
}

/** Host inputs of {@link usePublishTargetGuard}. */
export interface UsePublishTargetGuardOptions<
  TItem extends { version?: string },
> {
  /** The configured publish requests; only `checkPublishTarget` is used. Must be referentially stable. */
  client: Pick<PublishApiClient, 'checkPublishTarget'>;
  /**
   * Resolves the entity behind a publish-flow item, or `undefined` for an item
   * that is not publishable (it is then never reported as taken). Must be
   * referentially stable.
   */
  getEntity: (item: TItem) => PublishTargetEntity | undefined;
}

/** What {@link usePublishTargetGuard} hands to `usePublishFlow` and the host's publish call. */
export interface PublishTargetGuard<TItem extends { version?: string }> {
  /** `usePublishFlow`'s `onCheckTargetExists`: asks the backend whether the published path is taken. */
  onCheckTargetExists: (item: TItem, folderPath: string[]) => Promise<boolean>;
  /** `usePublishFlow`'s `isTargetTakenError`: true for the error {@link PublishTargetGuard.wrapPublish} throws. */
  isTargetTakenError: (error: unknown) => boolean;
  /** Wraps the host's publish call so a taken-target `409` is rejected as a `PublishTargetTakenError`. */
  wrapPublish: <Args extends unknown[], Result>(
    publish: (...args: Args) => Promise<Result>,
  ) => (...args: Args) => Promise<Result>;
}

const isPublishTargetTakenError = (error: unknown): boolean =>
  error instanceof PublishTargetTakenError;

/**
 * Wires the target check of a publish panel: the check request
 * (folder segments joined with `/`, the item's version when it has one), the
 * predicate that recognises a taken-target rejection, and the wrapper that
 * produces it. The request and its mapping stay in {@link PublishApiClient};
 * the panel and `usePublishFlow` only receive callbacks.
 * @param options - the publish client and the lookup of an item's entity
 */
export const usePublishTargetGuard = <TItem extends { version?: string }>({
  client,
  getEntity,
}: UsePublishTargetGuardOptions<TItem>): PublishTargetGuard<TItem> => {
  const onCheckTargetExists = useCallback(
    async (item: TItem, folderPath: string[]) => {
      const entity = getEntity(item);
      if (entity == null) return false;
      const { taken } = await client.checkPublishTarget(
        entity.entityType,
        entity.entityId,
        folderPath.join('/'),
        item.version || undefined,
      );
      return taken;
    },
    [client, getEntity],
  );

  return useMemo(
    () => ({
      onCheckTargetExists,
      isTargetTakenError: isPublishTargetTakenError,
      wrapPublish: wrapPublishTargetTaken,
    }),
    [onCheckTargetExists],
  );
};

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../context/NotificationContext';
import {
  EntityOperation,
  NotifiableEntity,
} from '../types/entity-notification';
import {
  ENTITY_OPERATION_NOTIFICATIONS,
  NotifiableOperation,
  OperationNotificationKeys,
} from '../utils/entity-notification';

/** Values interpolated into an operation notification sentence. */
export interface OperationNotificationParams {
  /** Name of the entity the operation ran on, rendered in quotes. */
  name: string;
  /** Target folder, required for `EntityOperation.PublishRequested`. */
  folder?: string;
  /**
   * Number of items the operation covered. Selects the plural form for the
   * pairs whose copy has `_one`/`_other` variants, e.g. a multi-file download.
   */
  count?: number;
}

interface UseOperationNotificationResult {
  notifyOperationSuccess: <TEntity extends NotifiableEntity>(
    entity: TEntity,
    operation: NotifiableOperation<TEntity>,
    params: OperationNotificationParams,
  ) => void;
}

/**
 * Raises the success notification for a completed entity operation.
 *
 * Call sites pass intent — an entity, an operation, and the values to interpolate —
 * instead of translation keys, so the wording of every "X created/deleted/downloaded
 * successfully" toast lives in one map (`ENTITY_OPERATION_NOTIFICATIONS`) rather than
 * drifting across the ~15 places that mutate entities.
 */
export const useOperationNotification = (): UseOperationNotificationResult => {
  const { t } = useTranslation();
  const { showSuccessNotification } = useNotification();

  const notifyOperationSuccess = useCallback(
    <TEntity extends NotifiableEntity>(
      entity: TEntity,
      operation: NotifiableOperation<TEntity>,
      params: OperationNotificationParams,
    ) => {
      const keys = ENTITY_OPERATION_NOTIFICATIONS[entity][
        operation as EntityOperation & NotifiableOperation<TEntity>
      ] as OperationNotificationKeys | undefined;

      /*
       * An unmapped pair is a compile error for every real caller. Should one reach
       * here through an untyped boundary, skip the toast rather than throw: the
       * operation itself has already succeeded and must not be reported as failed.
       */
      if (keys == null) return;

      const { titleKey, messageKey } = keys;

      /* The title is interpolated too: a plural pair (e.g. a multi-file download)
       * needs `count` to pick between its `_one` and `_other` variants. */
      showSuccessNotification({
        title: t(titleKey, { ...params }),
        message: t(messageKey, { ...params }),
      });
    },
    [t, showSuccessNotification],
  );

  return { notifyOperationSuccess };
};

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HeaderProps } from '../../../../models/details-header';
import { RecipientsCountStatus } from '../../../../types/recipients-count';

/** Parameters for {@link useRecipientsCount}. */
export type UseRecipientsCountParams = Pick<
  HeaderProps,
  'item' | 'onFetchRecipientsCount' | 'onRevokeShare' | 'isRevokeShareVisible'
>;

/** Per-item lookup of how many users hold shared access to an owned item. */
export const useRecipientsCount = ({
  item,
  onFetchRecipientsCount,
  onRevokeShare,
  isRevokeShareVisible,
}: UseRecipientsCountParams) => {
  const [recipientsCountStatus, setRecipientsCountStatus] = useState(
    RecipientsCountStatus.Idle,
  );
  const [recipientsCount, setRecipientsCount] = useState<number | undefined>(
    undefined,
  );
  /* The item whose lookup has already been started, so hovering and then
   * opening the menu does not issue the same request twice, and a response
   * that arrives after the panel moved on is discarded. */
  const requestedItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    requestedItemIdRef.current = null;
    setRecipientsCountStatus(RecipientsCountStatus.Idle);
    setRecipientsCount(undefined);
  }, [item.id]);

  const requestRecipientsCount = useCallback(() => {
    if (!onFetchRecipientsCount || requestedItemIdRef.current === item.id) {
      return;
    }
    /* Nothing to gate: an item that could never offer the action needs no
     * count, so no request is made for one. */
    if (
      !onRevokeShare ||
      item.isMyApp !== true ||
      isRevokeShareVisible?.(item) === false
    ) {
      return;
    }
    const requestedItemId = item.id;
    requestedItemIdRef.current = requestedItemId;
    setRecipientsCountStatus(RecipientsCountStatus.Loading);

    const resolve = async () => {
      try {
        const count = await onFetchRecipientsCount(item);
        if (requestedItemIdRef.current !== requestedItemId) return;
        setRecipientsCount(count);
        setRecipientsCountStatus(
          count == null
            ? RecipientsCountStatus.Unknown
            : RecipientsCountStatus.Resolved,
        );
      } catch {
        /* An unresolved count must not remove the only way to revoke, so the
         * action stays reachable — just without a number. */
        if (requestedItemIdRef.current !== requestedItemId) return;
        setRecipientsCount(undefined);
        setRecipientsCountStatus(RecipientsCountStatus.Unknown);
      }
    };
    void resolve();
  }, [item, onFetchRecipientsCount, onRevokeShare, isRevokeShareVisible]);

  return { recipientsCountStatus, recipientsCount, requestRecipientsCount };
};

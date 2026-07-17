import { NeutralButton } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE, DialSpinner } from '@epam/ai-dial-ui-kit';
import { IconTrash } from '@tabler/icons-react';
import { FC, useCallback, useState } from 'react';
import { CatalogItem } from '../../../../models/catalog-item';
import type { ItemDetailsTexts } from '../../../../models/item-details-props';
import { CatalogEntityType } from '../../../../types/entity-type';

/** Props for {@link DeleteButton}. */
interface DeleteButtonProps {
  /** The catalog item to delete. */
  item: CatalogItem;
  /**
   * Called when the Delete button is clicked. May return a promise; the
   * button shows a disabled state while pending.
   */
  onDelete?: (item: CatalogItem) => Promise<void> | void;
  /** Called after `onDelete` resolves successfully, e.g. to close the whole details panel. */
  onDeleted?: () => void;
  /** Text overrides for the button label. */
  texts?: ItemDetailsTexts;
}

/*
 * Delete is limited to entities the current user owns (applications and
 * toolsets in their personal space) — never Models, Guardrails, MCPs, or
 * Agents.
 */
const shouldShowDelete = (item: CatalogItem): boolean =>
  item.isMyApp === true &&
  (item.type === CatalogEntityType.Application ||
    item.type === CatalogEntityType.Toolset);

/**
 * Delete action button for the details header. Renders nothing for items the
 * current user doesn't own or that aren't deletable. Clicking it calls
 * `onDelete` immediately, with no confirmation step.
 */
export const DeleteButton: FC<DeleteButtonProps> = ({
  item,
  onDelete,
  onDeleted,
  texts,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClick = useCallback(async () => {
    setIsDeleting(true);

    try {
      await onDelete?.(item);
      onDeleted?.();
    } catch {
      // Failure feedback (e.g. a notification) is the caller's responsibility.
    } finally {
      setIsDeleting(false);
    }
  }, [item, onDelete, onDeleted]);

  if (!shouldShowDelete(item)) return null;

  return (
    <>
      <NeutralButton
        label={texts?.deleteActionLabel ?? 'Delete'}
        iconBefore={
          isDeleting ? (
            <span aria-hidden="true">
              <DialSpinner size={DIAL_ICON_SIZE.MD} />
            </span>
          ) : (
            <IconTrash size={DIAL_ICON_SIZE.MD} aria-hidden />
          )
        }
        onClick={handleClick}
        disabled={isDeleting}
      />
      {isDeleting && (
        <span role="status" aria-live="polite" className="sr-only">
          Deleting
        </span>
      )}
    </>
  );
};

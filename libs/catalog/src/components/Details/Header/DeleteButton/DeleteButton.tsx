import { NeutralButton } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
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
   * button shows a disabled/loading state while pending and an inline error
   * if it rejects.
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
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onDelete?.(item);
      onDeleted?.();
    } catch {
      setDeleteError(
        texts?.deleteErrorMessage ?? 'Failed to delete. Please try again.',
      );
    } finally {
      setIsDeleting(false);
    }
  }, [item, onDelete, onDeleted, texts?.deleteErrorMessage]);

  if (!shouldShowDelete(item)) return null;

  return (
    <div className="flex flex-col gap-1">
      <NeutralButton
        label={texts?.deleteActionLabel ?? 'Delete'}
        iconBefore={<IconTrash size={DIAL_ICON_SIZE.MD} />}
        onClick={handleClick}
        disabled={isDeleting}
      />
      {deleteError && <span className="text-error">{deleteError}</span>}
    </div>
  );
};

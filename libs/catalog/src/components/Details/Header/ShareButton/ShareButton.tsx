import { NeutralButton } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE, DialDropdown } from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconShare, IconTrash } from '@tabler/icons-react';
import { FC, type ReactNode, useCallback, useState } from 'react';
import { CatalogItem } from '../../../../models/catalog-item';
import { CatalogEntityType } from '../../../../types/entity-type';

/** Props for {@link ShareButton}. */
interface ShareButtonProps {
  /** The catalog item to share or unshare. */
  item: CatalogItem;
  /** Called when the button is clicked and no `shareOverlay` is provided. */
  onShare?: (item: CatalogItem) => void;
  /**
   * Renders the Share popover content anchored to the button. When
   * provided, clicking Share opens this popover instead of calling `onShare`.
   */
  shareOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode;
  /** Called when recipient-side Delete is clicked for an item shared with the current user. */
  onUnshare?: (item: CatalogItem) => void;
  /** Share button label. Defaults to `'Share'`. */
  label?: string;
  /** Recipient-side delete button label. Defaults to `'Delete'`. */
  unshareLabel?: string;
}

/*
 * Guardrail and MCP sharing is descoped for now — hide Share entirely for
 * those types rather than offering a button with undefined behavior.
 * Sharing is also limited to entities the current user owns (deployments
 * and toolsets in their personal space), not the whole catalog.
 */
const shouldShowShare = (item: CatalogItem): boolean =>
  item.isMyApp === true &&
  item.type !== CatalogEntityType.Guardrail &&
  item.type !== CatalogEntityType.Mcp;

/*
 * The recipient-side Delete action is the UI counterpart of Share: it shows only for
 * items shared with the current user (not owned by them), and is descoped
 * for Guardrail/MCP entities for the same reason Share is. `isMyApp` and
 * `sharedWithMe` are mutually exclusive for a given item, so Share and
 * Share and recipient-side Delete never render at the same time.
 */
const shouldShowUnshare = (item: CatalogItem): boolean =>
  item.isMyApp !== true &&
  item.sharedWithMe === true &&
  item.type !== CatalogEntityType.Guardrail &&
  item.type !== CatalogEntityType.Mcp;

/**
 * Share/Delete action button for the details header. Renders the Share
 * action for items the current user owns, the Delete action for items
 * shared with them, or nothing otherwise. When `shareOverlay` is provided,
 * clicking Share opens it in an anchored dropdown instead of calling
 * `onShare`; recipient-side Delete always calls `onUnshare` directly (its
 * confirmation is owned by the app-level details panel).
 */
export const ShareButton: FC<ShareButtonProps> = ({
  item,
  onShare,
  shareOverlay,
  onUnshare,
  label = 'Share',
  unshareLabel = 'Delete',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = useCallback(() => {
    if (shareOverlay) {
      setIsOpen((prev) => !prev);
      return;
    }
    onShare?.(item);
  }, [item, onShare, shareOverlay]);

  const handleUnshareClick = useCallback(() => {
    onUnshare?.(item);
  }, [item, onUnshare]);

  if (shouldShowUnshare(item)) {
    return (
      <NeutralButton
        label={unshareLabel}
        iconBefore={<IconTrash size={DIAL_ICON_SIZE.MD} />}
        onClick={handleUnshareClick}
      />
    );
  }

  if (!shouldShowShare(item)) return null;

  const button = (
    <NeutralButton
      label={label}
      iconBefore={<IconShare size={DIAL_ICON_SIZE.MD} />}
      iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.MD} />}
      onClick={handleClick}
      aria-haspopup={shareOverlay ? 'menu' : undefined}
      aria-expanded={shareOverlay ? isOpen : undefined}
    />
  );

  if (!shareOverlay) return button;

  return (
    <DialDropdown
      placement="bottom-end"
      matchReferenceWidth={false}
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={[]}
      outsideClosable
      listClassName="cp-dropdown-overlay"
      renderOverlay={() => shareOverlay(item, () => setIsOpen(false))}
    >
      {button}
    </DialDropdown>
  );
};

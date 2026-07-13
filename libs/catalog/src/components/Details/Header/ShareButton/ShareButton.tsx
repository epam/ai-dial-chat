import { NeutralButton } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE, DialDropdown } from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconShare } from '@tabler/icons-react';
import { FC, type ReactNode, useCallback, useState } from 'react';
import { CatalogItem } from '../../../../models/catalog-item';
import { CatalogEntityType } from '../../../../types/entity-type';

/** Props for {@link ShareButton}. */
interface ShareButtonProps {
  /** The catalog item to share. */
  item: CatalogItem;
  /** Called when the button is clicked and no `shareOverlay` is provided. */
  onShare?: (item: CatalogItem) => void;
  /**
   * Renders the Share popover content anchored to the button. When
   * provided, clicking Share opens this popover instead of calling `onShare`.
   */
  shareOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode;
  /** Button label. Defaults to `'Share'`. */
  label?: string;
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

/**
 * Share action button for the details header. Renders nothing for items the
 * current user doesn't own or that don't support sharing. When `shareOverlay`
 * is provided, clicking the button opens it in an anchored dropdown instead
 * of calling `onShare`.
 */
export const ShareButton: FC<ShareButtonProps> = ({
  item,
  onShare,
  shareOverlay,
  label = 'Share',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = useCallback(() => {
    if (shareOverlay) {
      setIsOpen((prev) => !prev);
      return;
    }
    onShare?.(item);
  }, [item, onShare, shareOverlay]);

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

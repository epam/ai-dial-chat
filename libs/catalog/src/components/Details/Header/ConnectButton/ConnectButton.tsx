import {
  DIAL_ICON_SIZE,
  NeutralButton,
  DialDropdown,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconPlugConnected } from '@tabler/icons-react';
import { FC, type ReactNode, useCallback, useState } from 'react';
import { CatalogItem } from '../../../../models/catalog-item';

/** Props for {@link ConnectButton}. */
interface ConnectButtonProps {
  /** The catalog item to connect. */
  item: CatalogItem;
  /**
   * Renders the Connect popover content anchored to the button. When
   * absent, the Connect button is never shown.
   */
  connectOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode;
  /** Controls whether the button is shown for the item. When absent or `false`, nothing renders. */
  isConnectVisible?: (item: CatalogItem) => boolean;
  /** Connect button label. Defaults to `'Connect'`. */
  label?: string;
}

/**
 * Connect action button for the details header. Renders nothing unless
 * both `isConnectVisible(item)` returns `true` and `connectOverlay` is
 * supplied — there is no non-overlay fallback action. Clicking the button
 * opens `connectOverlay` in an anchored dropdown.
 */
export const ConnectButton: FC<ConnectButtonProps> = ({
  item,
  connectOverlay,
  isConnectVisible,
  label = 'Connect',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  if (!isConnectVisible?.(item) || !connectOverlay) return null;

  const button = (
    <NeutralButton
      label={label}
      iconBefore={<IconPlugConnected size={DIAL_ICON_SIZE.MD} aria-hidden />}
      iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.MD} />}
      onClick={handleClick}
      aria-haspopup="menu"
      aria-expanded={isOpen}
    />
  );

  return (
    <DialDropdown
      placement="bottom-end"
      matchReferenceWidth={false}
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={[]}
      outsideClosable
      listClassName="cp-dropdown-overlay"
      renderOverlay={() => connectOverlay(item, () => setIsOpen(false))}
    >
      {button}
    </DialDropdown>
  );
};

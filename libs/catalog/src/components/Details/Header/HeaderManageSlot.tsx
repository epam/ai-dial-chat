import {
  DangerButton,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  DropdownOverlayRole,
  type DropdownItem,
  NeutralButton,
  NeutralIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconDots } from '@tabler/icons-react';
import type { FC, ReactNode } from 'react';
import type { HeaderProps, ManageAction } from '../../../models/details-header';
import { ShareButton } from './ShareButton/ShareButton';

/** Props for {@link HeaderManageSlot}. */
export interface HeaderManageSlotProps extends Pick<
  HeaderProps,
  'item' | 'onShare' | 'shareOverlay' | 'isShareVisible' | 'texts'
> {
  /** The lone Manage entry rendered as a button instead of a menu, if any. */
  promotedManageAction: ManageAction | undefined;
  /** Manage-menu items. The slot renders nothing when empty and nothing is promoted. */
  manageItems: DropdownItem[];
  /** Called when the Manage menu opens or closes. */
  onManageOpenChange: (isOpen: boolean) => void;
  /** Called on hover or focus of the Manage trigger, before a click. */
  onManageTriggerIntent: () => void;
  /** Whether Share renders in the action row rather than in the Manage menu. */
  isShareInActionRow: boolean;
  /** Whether Share is offered at all. */
  shouldShowShareAction: boolean;
  /** Whether the share popover anchored to the Manage trigger is open. */
  isShareOverlayOpen: boolean;
  /** Called to open or close the share popover. */
  onShareOverlayOpenChange: (isOpen: boolean) => void;
  /** Closes the share popover; handed to `shareOverlay`. */
  onCloseShareOverlay: () => void;
}

/** Manage slot of the details header: the overflow menu, or its lone entry as a button. */
export const HeaderManageSlot: FC<HeaderManageSlotProps> = ({
  item,
  promotedManageAction,
  manageItems,
  onManageOpenChange,
  onManageTriggerIntent,
  isShareInActionRow,
  shouldShowShareAction,
  shareOverlay,
  isShareOverlayOpen,
  onShareOverlayOpenChange,
  onCloseShareOverlay,
  onShare,
  isShareVisible,
  texts,
}) => {
  /*
   * The action-row form of a promoted Manage entry. Share is the one that
   * cannot be drawn generically: its popover anchors to the trigger, which
   * is what `ShareButton` — the same component the row already uses when
   * `isSharePrimary` puts Share there — exists to do. Delete accompanies
   * Share on every item that offers it today, so that branch is a guard
   * rather than a live path; it keeps the rule total if the two ever come
   * apart.
   */
  const renderPromotedManageAction = ({
    key,
    label,
    Icon,
    danger,
    onClick,
  }: ManageAction): ReactNode => {
    if (key === 'share') {
      return (
        <ShareButton
          item={item}
          onShare={onShare}
          shareOverlay={shareOverlay}
          isShareVisible={isShareVisible}
          label={texts?.shareLabel}
        />
      );
    }
    /* A destructive entry keeps the weight the menu gave it: dropping the
     * danger styling on the way to the row would quietly make Delete look
     * like Edit. */
    const ButtonComponent = danger ? DangerButton : NeutralButton;
    return (
      <ButtonComponent
        label={label}
        iconBefore={
          <Icon
            size={DIAL_ICON_SIZE.MD}
            aria-hidden
            stroke={DIAL_KIT_ICON_STROKE}
          />
        }
        onClick={onClick}
      />
    );
  };

  const renderManageMenu = (): ReactNode => {
    const menu = (
      <Dropdown
        items={manageItems}
        placement="bottom-end"
        matchReferenceWidth={false}
        onOpenChange={onManageOpenChange}
      >
        {/* Hover and focus start the recipient-count and publish-history
         * lookups before the click lands, so the "Revoke access" entry — and
         * the publish button's own state — are usually already settled by the
         * time the menu opens. */}
        <NeutralIconButton
          icon={
            <IconDots
              size={DIAL_ICON_SIZE.LG}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          aria-label={texts?.manageActionLabel ?? 'Manage'}
          aria-haspopup="menu"
          onMouseEnter={onManageTriggerIntent}
          onFocus={onManageTriggerIntent}
        />
      </Dropdown>
    );
    if (isShareInActionRow || !shareOverlay || !shouldShowShareAction) {
      return menu;
    }
    /* With Share inside the menu, its popover is anchored to this trigger
     * instead: the entry that opens it is unmounted by the time the popover
     * appears, so it has no node of its own to hang from. */
    return (
      <Dropdown
        placement="bottom-end"
        matchReferenceWidth={false}
        open={isShareOverlayOpen}
        onOpenChange={onShareOverlayOpenChange}
        trigger={[]}
        outsideClosable
        /* The host's share popover carries its own `dialog` role. */
        overlayRole={DropdownOverlayRole.None}
        renderOverlay={() => shareOverlay(item, onCloseShareOverlay)}
      >
        {menu}
      </Dropdown>
    );
  };

  if (promotedManageAction) {
    return renderPromotedManageAction(promotedManageAction);
  }
  return manageItems.length > 0 ? renderManageMenu() : null;
};

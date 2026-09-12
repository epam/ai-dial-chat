import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { BottomSheetShell } from '@epam/ai-dial-conversation-input';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  Input,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import {
  memo,
  useCallback,
  useMemo,
  useState,
  type FC,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DeploymentSelectorI18nKeys } from '../../constants/translation-keys';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useDeploymentSelectorFieldOverlay } from './useDeploymentSelectorFieldOverlay';

interface Props {
  /** Currently selected deployment id, or `null` when none is selected. */
  selectedId: string | null;
  /** Called with the newly selected deployment's id; the panel closes itself afterward. */
  onSelect: (id: string) => void;
  /** Text shown in the trigger when `selectedId` is `null`. */
  placeholder: string;
  /** Id of the host-rendered label element this trigger is described by. */
  labelledById?: string;
  /** When `true`, the trigger does not open and renders dimmed. Defaults to `false`. */
  isDisabled?: boolean;
  /** When `true`, the trigger renders with error/invalid styling. Defaults to `false`. */
  isInvalid?: boolean;
  /** Additional class names applied to the trigger button. */
  className?: string;
}

/**
 * Full-width outlined form-field trigger that opens the same deployment
 * selector overlay content (search, favorites, Browse) the chat input's
 * icon trigger opens, via `useDeploymentSelectorFieldOverlay`. Its own
 * selection is independent of the chat input's active deployment. On
 * desktop the overlay opens as a dropdown popover; on mobile as a bottom
 * sheet — the same `BottomSheetShell` the chat page's picker uses.
 */
const DeploymentSelectorFieldTrigger: FC<Props> = ({
  selectedId,
  onSelect,
  placeholder,
  labelledById,
  isDisabled = false,
  isInvalid = false,
  className,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  /* One open state shared by both presentations (only one is ever mounted).
   * Crossing the breakpoint while open — device rotation — intentionally
   * keeps it open: the picker continues in the other presentation instead
   * of dismissing the user mid-selection. */
  const [isOpen, setIsOpen] = useState(false);

  const { renderOverlay, catalogModal, isLoading, error, resolvedLabel } =
    useDeploymentSelectorFieldOverlay(selectedId, (id) => {
      onSelect(id);
      setIsOpen(false);
    });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (isDisabled) return;
      setIsOpen(open);
    },
    [isDisabled],
  );

  const handleTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      } else if (
        isMobile &&
        (event.key === 'Enter' || event.key === ' ') &&
        !isDisabled
      ) {
        /*
         * Keyboard parity for the mobile wrapper's tap target: there is no
         * `Dropdown` in that branch to synthesize activation, so the
         * combobox input opens the sheet itself. On desktop the `Dropdown`'s
         * own trigger already opens on Enter — handling it here too would
         * double-fire. `preventDefault` stops Space from scrolling the page.
         */
        event.preventDefault();
        setIsOpen(true);
      }
    },
    [isMobile, isDisabled],
  );

  const handleFieldClick = useCallback(() => {
    if (!isDisabled) setIsOpen(true);
  }, [isDisabled]);

  const handleSheetClose = useCallback(() => setIsOpen(false), []);

  /*
   * `resolvedLabel` (including its raw-id fallback for an unresolved
   * deployment) is rendered as the field's `value`, exactly like a real
   * selection would be — so a background refetch never blanks out an
   * already-displayed selection with loading/error copy. Loading/error text
   * only replaces the placeholder while nothing has resolved yet.
   */
  let effectivePlaceholder = placeholder;
  if (resolvedLabel == null) {
    if (isLoading) {
      effectivePlaceholder = t(DeploymentSelectorI18nKeys.Loading);
    } else if (error) {
      effectivePlaceholder = t(DeploymentSelectorI18nKeys.Error);
    }
  }

  /*
   * Shared combobox trigger for both presentations; only the popup semantics
   * differ per branch — the mobile sheet is a `role="dialog"` (so
   * `aria-haspopup` switches to `dialog`), while `aria-expanded` tracks the
   * one `isOpen` state either way.
   */
  /* Memoized so unrelated re-renders of the host form (keystrokes in other
   * fields) reuse the same element object and React skips re-rendering the
   * Input subtree — the element is slotted as `Dropdown`'s child on desktop
   * and the wrapper's child on mobile. */
  const fieldInput = useMemo(
    () => (
      <Input
        readOnly
        role="combobox"
        aria-haspopup={isMobile ? 'dialog' : 'listbox'}
        aria-expanded={isOpen}
        aria-labelledby={labelledById}
        disabled={isDisabled}
        invalid={isInvalid || Boolean(error)}
        value={resolvedLabel ?? ''}
        placeholder={effectivePlaceholder}
        onKeyDown={handleTriggerKeyDown}
        containerClassName="w-full"
        wrapperClassName={mergeClasses('cursor-pointer', className)}
        className="cursor-pointer"
        iconAfter={
          isLoading ? (
            <Spinner
              size={DIAL_ICON_SIZE.SM}
              ariaLabel={t(DeploymentSelectorI18nKeys.Loading)}
            />
          ) : (
            // A vertical rotation is direction-agnostic (up/down does not
            // flip under RTL), so no `rtl:` mirroring class is needed here.
            <IconChevronDown
              size={DIAL_ICON_SIZE.MD}
              className={mergeClasses(
                'transition-transform',
                isOpen && 'rotate-180',
              )}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          )
        }
      />
    ),
    [
      isMobile,
      isOpen,
      t,
      labelledById,
      isDisabled,
      isInvalid,
      error,
      resolvedLabel,
      effectivePlaceholder,
      handleTriggerKeyDown,
      className,
      isLoading,
    ],
  );

  if (isMobile) {
    return (
      <>
        {/*
         * Pointer parity with `Dropdown`'s desktop behavior, where a click
         * anywhere in the field (including the chevron and padding, which
         * sit outside the `<input>` element) opens the popup. Keyboard
         * parity comes from the input's own Enter/Space handling above.
         */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the wrapper is
            deliberately not the interactive control (the combobox input inside
            it is, and it carries the Enter/Space handling); the wrapper only
            widens the pointer tap target to the chevron and padding. */}
        <div className="w-full" onClick={handleFieldClick}>
          {fieldInput}
        </div>
        <BottomSheetShell
          isOpen={isOpen}
          title={t(DeploymentSelectorI18nKeys.AriaLabel)}
          closeLabel={t(DeploymentSelectorI18nKeys.CloseLabel)}
          onClose={handleSheetClose}
          /* At most 90% of the viewport; below that the height follows the
           * content. `max-h` here replaces the shell's own `max-h-[85dvh]`
           * — `mergeClasses` is tailwind-merge, so the later class in the
           * merge wins the conflict. */
          className="max-h-[90dvh]"
        >
          {renderOverlay(handleSheetClose)}
        </BottomSheetShell>
        {catalogModal}
      </>
    );
  }

  return (
    <>
      <Dropdown
        open={isOpen}
        onOpenChange={handleOpenChange}
        outsideClosable
        disabled={isDisabled}
        renderOverlay={() => renderOverlay(() => setIsOpen(false))}
        listClassName="!bg-layer-raised"
        className="w-full"
      >
        {/*
         * Built on the same `Input` component `Select` wraps in a `readOnly`
         * combobox (see `@epam/ai-dial-ui-kit` Select.tsx), so this trigger's
         * chrome (border, radius, height, focus/hover, colors) always stays
         * pixel-identical to every other field/dropdown in the app instead
         * of duplicating those styles by hand. Opening is handled by
         * `Dropdown`'s default click trigger (a click anywhere in the field,
         * including the chevron, toggles it via `onOpenChange`) — the same
         * way `Select` opens, rather than a manual `onClick` scoped to just
         * the `<input>` element, which the icon sits outside of.
         */}
        {fieldInput}
      </Dropdown>
      {catalogModal}
    </>
  );
};

export default memo(DeploymentSelectorFieldTrigger);

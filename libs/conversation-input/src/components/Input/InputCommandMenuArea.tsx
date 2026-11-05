import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Dropdown, DropdownOverlayRole } from '@epam/ai-dial-ui-kit';
import type { ReactNode, RefObject } from 'react';
import type { InputProps } from '../../models/Input';
import type { useCommandMenuAnchor } from './hooks/useCommandMenuAnchor';
import type { useCommandMenuController } from './hooks/useCommandMenuController';

type CommandMenuController = ReturnType<typeof useCommandMenuController>;

interface InputCommandMenuAreaProps {
  textarea: ReactNode;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  commandMenu: InputProps['commandMenu'];
  caretAnchor: ReturnType<typeof useCommandMenuAnchor>['caretAnchor'];
  fontClassName: string | undefined;
  isMenuOpen: boolean;
  query: CommandMenuController['query'];
  activeWordStart: CommandMenuController['activeWordStart'];
  listboxId: CommandMenuController['commandMenuListboxId'];
  activeOptionId: CommandMenuController['activeCommandOptionId'];
  overlayRef: CommandMenuController['commandMenuOverlayRef'];
  onOutsidePress: () => void;
  onClose: CommandMenuController['handleCloseCommandMenu'];
}

/**
 * The command menu anchors to the trigger word's own on-screen position,
 * not to the textarea as a whole — the kit `Dropdown` wraps its
 * `children` in the actual floating-ui reference element, so that
 * element has to sit at `caretAnchor` rather than the textarea itself
 * (which, unlike the marker, sits fixed at the box's own top-left
 * regardless of where the trigger word is). `Dropdown` takes no `style`
 * prop, only `className`, so it cannot be positioned directly with a
 * computed pixel value — instead, a plain `<div>` this component fully
 * controls carries the inline `style` and is absolutely positioned at
 * `caretAnchor`; `Dropdown`'s own internal reference span, rendered as
 * that div's only child with no positioning of its own, lands in normal
 * flow at the div's origin, i.e. exactly at the caret. The real textarea
 * renders as a sibling instead of `Dropdown`'s child. `trigger={[]}`
 * keeps the controlled `open` prop the only opener, focus stays in the
 * textarea on open (`initialFocus={-1}`), and clicks inside the textarea
 * count as inside the menu (`outsidePressIgnoreRef`).
 * `matchReferenceWidth={false}` drops the kit's default min-width equal
 * to the (now zero-size) reference, so the overlay sizes to its content.
 *
 * Always the same Fragment with the textarea as its first child, so toggling
 * `commandMenu` (e.g. switching to a skills-capable model) never changes the
 * textarea's parent type and never remounts it (focus, caret and IME state
 * survive).
 */
export const InputCommandMenuArea = ({
  textarea,
  textareaRef,
  commandMenu,
  caretAnchor,
  fontClassName,
  isMenuOpen,
  query,
  activeWordStart,
  listboxId,
  activeOptionId,
  overlayRef,
  onOutsidePress,
  onClose,
}: InputCommandMenuAreaProps) => (
  <>
    {textarea}
    {commandMenu != null && (
      <div
        aria-hidden
        className={mergeClasses(
          'pointer-events-none absolute',
          fontClassName || 'dial-body-paragraph-text',
        )}
        style={{ left: caretAnchor?.left ?? 0, top: caretAnchor?.top ?? 0 }}
      >
        <Dropdown
          open={isMenuOpen}
          onOpenChange={(isOpen) => {
            /*
             * Escape is intercepted earlier (`handleCommandMenuKeyDown`,
             * with `stopPropagation`) and never reaches this listener, so
             * a `false` here is always an outside click — the
             * non-latching close.
             */
            if (!isOpen) onOutsidePress();
          }}
          placement="top-start"
          trigger={[]}
          initialFocus={-1}
          /* The menu brings its own `listbox` and the textarea drives it,
             so the overlay adds no role of its own. */
          overlayRole={DropdownOverlayRole.None}
          matchReferenceWidth={false}
          outsidePressIgnoreRef={textareaRef}
          renderOverlay={() => {
            /*
             * The wrapper is always rendered: its ref scopes the
             * keyboard's option lookup to this menu. It becomes a
             * labeled group only when the host names the menu region.
             */
            const hasMenuLabel = commandMenu.menuLabel != null;
            return (
              <div
                ref={overlayRef}
                role={hasMenuLabel ? 'group' : undefined}
                aria-label={commandMenu.menuLabel}
              >
                {commandMenu.renderMenu({
                  query,
                  caretPosition: activeWordStart ?? 0,
                  close: onClose,
                  listboxId,
                  activeOptionId,
                })}
              </div>
            );
          }}
        >
          {/*
           * floating-ui's actual reference element — sized to match the
           * caret marker's box. See `openspec/changes/archive/2026-09-25-multi-skill-message-mentions/design.md` Decision 3b
           * (multi-skill-message-mentions).
           */}
          <span aria-hidden className="inline-block h-lh w-0" />
        </Dropdown>
      </div>
    )}
  </>
);

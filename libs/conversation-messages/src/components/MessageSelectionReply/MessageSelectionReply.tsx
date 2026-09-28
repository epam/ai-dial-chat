import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Button,
  ButtonVariant,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconArrowBackUp } from '@tabler/icons-react';
import { useLayoutEffect, useState, type FC, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import styles from './MessageSelectionReply.module.scss';

/** Color overrides for the Reply action. */
export interface MessageSelectionReplyColors {
  /** Button background. Falls back to `--bg-layer-raised`. */
  background?: string;
  /** Hover background. Falls back to `--bg-layer-base`. */
  hoverBackground?: string;
  /** Label and icon color. Falls back to `--text-primary`. */
  text?: string;
}

/** Typography overrides for the Reply action. */
export interface MessageSelectionReplyTypography {
  /** Button label class. Defaults to `'dial-small-text'`. */
  fontClassName?: string;
}

/** Appearance overrides for the Reply action. */
export interface MessageSelectionReplyStyles {
  /** Button colors, applied as CSS custom properties. */
  colors?: MessageSelectionReplyColors;
  /** Button label typography. */
  typography?: MessageSelectionReplyTypography;
  /** Extra classes on the floating root, for example a host stacking level. */
  className?: string;
  /** Extra classes on the button. */
  buttonClassName?: string;
}

/** Localized strings rendered by {@link MessageSelectionReply}. */
export interface MessageSelectionReplyLabels {
  /** Visible and accessible Reply action label. */
  reply: string;
  /** Polite announcement when a selection becomes actionable. */
  selectionAvailable: string;
  /** Polite announcement after the composer accepts a Reply attachment. */
  attachmentAdded: string;
}

/** Props accepted by {@link MessageSelectionReply}. */
export interface MessageSelectionReplyProps {
  /** Visible selection rectangle. Omit to unmount the action. */
  rect: DOMRect | undefined;
  /** Receives the floating action root. */
  actionRef: RefObject<HTMLDivElement | null>;
  /** Creates an attachment from the captured selection. */
  onReply: () => void;
  /** Increments after the composer accepts a Reply attachment. */
  addedRevision: number;
  /** Localized button and announcement strings. */
  labels: MessageSelectionReplyLabels;
  /** Appearance overrides for the floating action. */
  styles?: MessageSelectionReplyStyles;
  /** Same-document portal destination. Defaults to `document.body`; null defers rendering. */
  portalContainer?: HTMLElement | null;
}

/** Offers Reply beside a native selection while leaving browser selection controls intact. */
export const MessageSelectionReply: FC<MessageSelectionReplyProps> = ({
  rect,
  actionRef,
  onReply,
  addedRevision,
  labels,
  styles: actionStyles,
  portalContainer,
}) => {
  const { colors, typography, className, buttonClassName } = actionStyles ?? {};
  const fontClassName = typography?.fontClassName ?? 'dial-small-text';
  const container =
    portalContainer === undefined
      ? typeof document === 'undefined'
        ? null
        : document.body
      : portalContainer;
  const cssVars = buildCssVars({
    '--cm-reply-background': colors?.background,
    '--cm-reply-hover-background': colors?.hoverBackground,
    '--cm-reply-text': colors?.text,
  });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    if (!rect || !actionRef.current) return;
    const bounds = actionRef.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? document.documentElement.clientWidth;
    const height = viewport?.height ?? document.documentElement.clientHeight;
    const y =
      rect.top - bounds.height - 8 >= top + 8
        ? rect.top - bounds.height - 8
        : rect.bottom + 8;
    setPosition({
      x: Math.max(
        left + 8,
        Math.min(rect.left, left + width - bounds.width - 8),
      ),
      y: Math.max(top + 8, Math.min(y, top + height - bounds.height - 8)),
    });
  }, [
    rect,
    actionRef,
    container,
    className,
    buttonClassName,
    fontClassName,
    labels.reply,
  ]);
  if (!container) return null;
  return createPortal(
    <>
      {rect && (
        <div
          ref={actionRef}
          className={mergeClasses(
            'fixed left-0 top-0 z-50 max-w-[calc(100vw-16px)]',
            className,
          )}
          style={{
            ...cssVars,
            transform: `translate(${position.x}px, ${position.y}px)`,
          }}
        >
          {/* Physical origin is intentional: the transform uses viewport coordinates in both directions. */}
          <Button
            variant={ButtonVariant.Neutral}
            size={ElementSize.Small}
            label={labels.reply}
            onClick={onReply}
            textClassName={fontClassName}
            className={mergeClasses(
              styles.button,
              'h-8 min-h-8 min-w-11 px-2 shadow-lg mobile:h-11 mobile:min-h-11',
              buttonClassName,
            )}
            iconAfter={
              <IconArrowBackUp
                size={16}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden="true"
                className="rtl:scale-x-[-1]"
              />
            }
          />
        </div>
      )}
      <div role="status" aria-live="polite" className="sr-only">
        {rect ? (
          labels.selectionAvailable
        ) : addedRevision > 0 ? (
          <span key={addedRevision}>{labels.attachmentAdded}</span>
        ) : null}
      </div>
    </>,
    container,
  );
};

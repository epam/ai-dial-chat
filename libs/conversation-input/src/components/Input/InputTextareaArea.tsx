import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { ReactNode, RefObject } from 'react';
import type { HighlightedTextRange } from '../../models/Input';
import {
  type MirrorInsertion,
  renderHighlightedText,
} from '../../utils/highlight-mirror';
import styles from './Input.module.scss';

interface InputTextareaAreaProps {
  /* Measured by `useCommandMenuAnchor` as the origin of the caret anchor. */
  areaRef: RefObject<HTMLDivElement | null>;
  mirrorRef: RefObject<HTMLDivElement | null>;
  isMirrorActive: boolean;
  fontClassName: string | undefined;
  message: string;
  mentionRanges: HighlightedTextRange[];
  mirrorInsertions: MirrorInsertion[];
  selectionRects: DOMRect[];
  /* The textarea with the command menu (`InputCommandMenuArea`). */
  children: ReactNode;
}

/**
 * The textarea area of `Input`: the mention-highlight mirror with its
 * replacement selection highlight, layered over the textarea and its
 * command menu. Presentational and private to `Input`.
 */
export const InputTextareaArea = ({
  areaRef,
  mirrorRef,
  isMirrorActive,
  fontClassName,
  message,
  mentionRanges,
  mirrorInsertions,
  selectionRects,
  children,
}: InputTextareaAreaProps) => (
  <div
    ref={areaRef}
    // Bleeds 4px past each edge, canceling the ps-1/pe-1 below.
    className="relative -ms-1 -me-1 w-[calc(100%+8px)]"
  >
    {isMirrorActive && (
      <div
        ref={mirrorRef}
        className={mergeClasses(
          styles.textarea,
          fontClassName || 'dial-body-paragraph-text',
          // Bleed room for chip edges — see `openspec/changes/archive/2026-09-25-multi-skill-message-mentions/design.md` Decision 3a.
          'pointer-events-none absolute inset-0 z-10 max-h-[272px] w-full overflow-hidden ps-1 pe-1 wrap-anywhere whitespace-pre-wrap',
        )}
      >
        {renderHighlightedText(
          message,
          mentionRanges,
          mirrorInsertions,
          styles.mentionHighlight,
          styles.mentionHighlightUnsupported,
        )}
        {selectionRects.map((rect, index) => (
          <div
            key={`selection-${index}`}
            aria-hidden
            className={mergeClasses(
              'pointer-events-none absolute rounded-sm',
              styles.selectionHighlight,
            )}
            /*
             * A measured pixel rect from `Range.getClientRects()` — see
             * the `left`/`top` exception noted on `caretAnchor` in `useCommandMenuAnchor`.
             */
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            }}
          />
        ))}
      </div>
    )}
    {children}
  </div>
);

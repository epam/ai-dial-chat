import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { ElementSize, NeutralButton } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode } from 'react';
import { QUOTATIONS_CLASS } from '../../constants/public-class-names';

/** User-visible strings for `CitationMarker`. */
export interface CitationMarkerLabels {
  /** Accessible label for the marker button. */
  ariaLabel: string;
  /** Button text when `annotationCount === 1`. */
  label: string;
  /** Button text when `annotationCount > 1`. */
  labelWithOverflow: string;
}

/** Props for the `CitationMarker` component. */
export interface CitationMarkerProps {
  /** Human-readable source name derived from the attachment URL. */
  sourceName: string;
  /** Total number of annotations in this citation group. */
  annotationCount: number;
  /** Called when the user clicks the marker to open the citation popup. */
  onOpen: () => void;
  /** Optional icon rendered before the label; omitted by default. */
  icon?: ReactNode;
  /** User-visible strings. */
  labels: CitationMarkerLabels;
  /** Typography class applied to the marker's label text. Defaults to `'dial-caption-text'`. */
  labelClassName?: string;
}

/** Inline button that opens the citation popup for a source group. */
export const CitationMarker: FC<CitationMarkerProps> = ({
  annotationCount,
  onOpen,
  icon,
  labels,
  labelClassName = 'dial-caption-text',
}) => (
  <NeutralButton
    size={ElementSize.Small}
    /*
     * A source name is server-supplied and routinely a full folder path plus a
     * page number, long enough to wrap at one of its hyphens. The pill is a
     * fixed 24px tall and centers its content, so a second line overflows it —
     * the marker stays one ellipsised line instead, capped so several markers
     * share a row. `min-w-0` is what lets the label shrink below its text
     * width; a flex item's `min-width: auto` would otherwise hold it open.
     * The full name remains in the card header and in `aria-label`.
     */
    className={mergeClasses('max-w-[240px]', QUOTATIONS_CLASS.citationMarker)}
    textClassName="min-w-0 truncate"
    iconBefore={icon}
    label={
      <span className={labelClassName}>
        {annotationCount > 1 ? labels.labelWithOverflow : labels.label}
      </span>
    }
    aria-label={labels.ariaLabel}
    onClick={onOpen}
  />
);

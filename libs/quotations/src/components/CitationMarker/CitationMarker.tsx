import { ElementSize, NeutralButton } from '@epam/ai-dial-ui-kit';
import { FC, memo, ReactNode } from 'react';

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
}

/** Inline button that opens the citation popup for a source group. */
export const CitationMarker: FC<CitationMarkerProps> = ({
  annotationCount,
  onOpen,
  icon,
  labels,
}) => {
  const label = (
    <span className="flex items-center gap-1">
      {icon}
      <span className="dial-caption-text">
        {annotationCount > 1 ? labels.labelWithOverflow : labels.label}
      </span>
    </span>
  );

  return (
    <NeutralButton
      size={ElementSize.Small}
      label={label}
      aria-label={labels.ariaLabel}
      onClick={onOpen}
    />
  );
};

export default memo(CitationMarker);

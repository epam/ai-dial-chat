import type { Annotation } from '@epam/ai-dial-chat-shared';
import { DialTooltip } from '@epam/ai-dial-ui-kit';
import { FC, memo, ReactNode, useCallback, useMemo } from 'react';
import { useCitationCardContext } from '../../context/CitationCardContext';
import type { AnnotationGroup } from '../../utils/group-annotations-by-source';
import {
  CitationCard,
  type CitationCardLabels,
  type CitationCardTypography,
} from '../CitationCard/CitationCard';
import {
  CitationMarker,
  type CitationMarkerLabels,
} from '../CitationMarker/CitationMarker';

/** Props for the `CitationDropdown` component. */
export interface CitationDropdownProps {
  /** The annotation group represented by this marker+popup pair. */
  group: AnnotationGroup;
  /**
   * Called when the user clicks "Preview" for an annotation. Omit when the
   * group has nothing previewable — the "Preview" button is hidden.
   */
  onPreview?: (annotation: Annotation) => void;
  /** Called when the user clicks "Open in browser" for an annotation. */
  onOpenInBrowser: (annotation: Annotation) => void;
  /** Optional icon rendered before the marker's label. */
  icon?: ReactNode;
  /** Optional icon rendered in the card header. When absent, no header icon is shown. */
  headerIcon?: ReactNode;
  /** User-visible strings for the card popup. */
  cardLabels: CitationCardLabels;
  /** User-visible strings for the inline marker button. */
  markerLabels: CitationMarkerLabels;
  /** Optional typography overrides forwarded to the card. */
  cardTypography?: CitationCardTypography;
  /** Typography class forwarded to the marker's label text. Defaults to `'dial-caption-text'`. */
  markerLabelClassName?: string;
}

/** Combines `CitationMarker` and `CitationCard` into a tooltip-based dropdown. Requires a `CitationCardProvider` ancestor. */
export const CitationDropdown: FC<CitationDropdownProps> = ({
  group,
  onPreview,
  onOpenInBrowser,
  icon,
  headerIcon,
  cardLabels,
  markerLabels,
  cardTypography,
  markerLabelClassName,
}) => {
  const citationCard = useCitationCardContext();
  const isOpen = citationCard.isOpen(group.sourceUrl);
  const activeIndex = citationCard.getActiveIndex(group.sourceUrl);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) citationCard.closePopup();
    },
    [citationCard],
  );

  const handlePreview = useMemo(
    () =>
      onPreview
        ? (annotation: Annotation) => {
            onPreview(annotation);
            citationCard.closePopup();
          }
        : undefined,
    [onPreview, citationCard],
  );

  return (
    <DialTooltip
      open={isOpen}
      onOpenChange={handleOpenChange}
      placement="bottom-end"
      triggerClassName="ms-1 inline-flex align-middle"
      contentClassName="!p-0 !bg-transparent !border-0 !shadow-none !max-w-none !rounded-none"
      tooltip={
        <CitationCard
          group={group}
          activeIndex={activeIndex}
          onIndexChange={(i) => citationCard.setActiveIndex(group.sourceUrl, i)}
          onPreview={handlePreview}
          onOpenInBrowser={onOpenInBrowser}
          headerIcon={headerIcon}
          labels={cardLabels}
          typography={cardTypography}
        />
      }
    >
      <CitationMarker
        sourceName={group.sourceName}
        annotationCount={group.annotations.length}
        onOpen={() => citationCard.openPopup(group.sourceUrl)}
        icon={icon}
        labels={markerLabels}
        labelClassName={markerLabelClassName}
      />
    </DialTooltip>
  );
};

export default memo(CitationDropdown);

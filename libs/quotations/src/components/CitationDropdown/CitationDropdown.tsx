import type { Annotation } from '@epam/ai-dial-chat-shared';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Tooltip } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode, useCallback, useId, useMemo } from 'react';
import { QUOTATIONS_CLASS } from '../../constants/public-class-names';
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
import styles from './CitationDropdown.module.scss';

/** Props for the `CitationDropdown` component. */
export interface CitationDropdownProps {
  /** The annotation group represented by this marker+popup pair. */
  group: AnnotationGroup;
  /**
   * Called when the user clicks "Preview" for an annotation. Omit when the
   * group has nothing previewable — the "Preview" button is hidden.
   */
  onPreview?: (annotation: Annotation) => void;
  /** Whether the host can preview the active annotation. Defaults to allowing preview when `onPreview` is provided. */
  isPreviewable?: (annotation: Annotation) => boolean;
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
  isPreviewable,
  onOpenInBrowser,
  icon,
  headerIcon,
  cardLabels,
  markerLabels,
  cardTypography,
  markerLabelClassName,
}) => {
  const citationCard = useCitationCardContext();
  const ownerKey = useId();
  const isOpen = citationCard.isOpen(ownerKey);
  const activeIndex = citationCard.getActiveIndex(group.groupKey);
  const annotation = group.annotations[activeIndex] ?? group.primaryAnnotation;
  const canPreview = isPreviewable?.(annotation) ?? true;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) citationCard.closePopup(ownerKey);
    },
    [citationCard, ownerKey],
  );

  const handlePreview = useMemo(
    () =>
      onPreview && canPreview
        ? (annotation: Annotation) => {
            onPreview(annotation);
            citationCard.closePopup(ownerKey);
          }
        : undefined,
    [onPreview, canPreview, citationCard, ownerKey],
  );

  /*
   * This is a controlled popover carrying an interactive card and needs
   * `bottom-end` so the 400px card aligns with the marker instead of
   * overhanging it. The resolved `Tooltip` export is the 2.0 component; it
   * narrows `placement` to the four `TooltipPlacement` sides, which cannot
   * express `-end` alignment, so no `placement` is passed here.
   */
  return (
    <Tooltip
      open={isOpen}
      onOpenChange={handleOpenChange}
      triggerClassName={mergeClasses(
        'ms-1 inline-flex align-middle',
        styles.trigger,
      )}
      contentClassName={mergeClasses(
        '!p-0 !bg-transparent !border-0 !shadow-none !max-w-none !rounded-none',
        styles.content,
        QUOTATIONS_CLASS.citationDropdown,
      )}
      tooltip={
        <CitationCard
          group={group}
          activeIndex={activeIndex}
          onIndexChange={(i) => citationCard.setActiveIndex(group.groupKey, i)}
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
        onOpen={() => citationCard.openPopup(ownerKey)}
        icon={icon}
        labels={markerLabels}
        labelClassName={markerLabelClassName}
      />
    </Tooltip>
  );
};

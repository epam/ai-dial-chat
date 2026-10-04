import type { Annotation } from '@epam/ai-dial-chat-shared';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Dropdown } from '@epam/ai-dial-ui-kit';
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
  /** Whether the card shows the "Download" button for a previewable file. Defaults to `true`. */
  isDownloadEnabled?: boolean;
  /** Whether the host's preview panel is open; a marker click then previews the active annotation directly instead of showing the card. Defaults to `false`. */
  isPreviewOpen?: boolean;
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

/** Combines `CitationMarker` and `CitationCard` into a click-opened popover. Requires a `CitationCardProvider` ancestor. */
export const CitationDropdown: FC<CitationDropdownProps> = ({
  group,
  onPreview,
  isPreviewable,
  onOpenInBrowser,
  isDownloadEnabled = true,
  isPreviewOpen = false,
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

  const handleMarkerOpen = useCallback(() => {
    if (isPreviewOpen && handlePreview) {
      handlePreview(annotation);
      return;
    }
    citationCard.openPopup(ownerKey);
  }, [isPreviewOpen, handlePreview, annotation, citationCard, ownerKey]);

  const renderCard = useCallback(
    () => (
      <CitationCard
        group={group}
        activeIndex={activeIndex}
        onIndexChange={(i) => citationCard.setActiveIndex(group.groupKey, i)}
        onPreview={handlePreview}
        onOpenInBrowser={onOpenInBrowser}
        isDownloadEnabled={isDownloadEnabled}
        headerIcon={headerIcon}
        labels={cardLabels}
        typography={cardTypography}
      />
    ),
    [
      group,
      activeIndex,
      citationCard,
      handlePreview,
      onOpenInBrowser,
      isDownloadEnabled,
      headerIcon,
      cardLabels,
      cardTypography,
    ],
  );

  /*
   * The card is interactive content opened by a tap or click, so it is hosted
   * in a controlled `Dropdown` overlay rather than a `Tooltip`: the kit's
   * tooltips render nothing on a touch-only device (`hover: none`), which left
   * the card unreachable on mobile. `trigger={[]}` keeps the marker's own
   * `onOpen` the only way in — it chooses between opening the card and
   * previewing directly — while the dropdown still handles outside-press and
   * Escape dismissal, focus return, and `bottom-end` alignment with the
   * marker. The panel surface is stripped because the card paints its own.
   */
  return (
    <Dropdown
      open={isOpen}
      onOpenChange={handleOpenChange}
      trigger={[]}
      placement="bottom-end"
      matchReferenceWidth={false}
      className={mergeClasses('ms-1 inline-flex align-middle', styles.trigger)}
      listClassName={mergeClasses(
        '!p-0 !bg-transparent !shadow-none !rounded-none',
        QUOTATIONS_CLASS.citationDropdown,
      )}
      renderOverlay={renderCard}
    >
      <CitationMarker
        sourceName={group.sourceName}
        annotationCount={group.annotations.length}
        onOpen={handleMarkerOpen}
        icon={icon}
        labels={markerLabels}
        labelClassName={markerLabelClassName}
      />
    </Dropdown>
  );
};

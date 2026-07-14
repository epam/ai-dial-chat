import type { Annotation } from '@epam/ai-dial-chat-shared';
import { DialTooltip } from '@epam/ai-dial-ui-kit';
import { FC, memo, ReactNode, useCallback, useMemo } from 'react';
import { useCitationCardContext } from '../../../context/CitationCardContext';
import type { AnnotationGroup } from '../../../utils/group-annotations-by-source';
import CitationCard from '../CitationCard/CitationCard';
import CitationMarker from '../CitationMarker/CitationMarker';

interface Props {
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
}

const CitationDropdown: FC<Props> = ({
  group,
  onPreview,
  onOpenInBrowser,
  icon,
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
        />
      }
    >
      <CitationMarker
        sourceName={group.sourceName}
        annotationCount={group.annotations.length}
        onOpen={() => citationCard.openPopup(group.sourceUrl)}
        icon={icon}
      />
    </DialTooltip>
  );
};

export default memo(CitationDropdown);

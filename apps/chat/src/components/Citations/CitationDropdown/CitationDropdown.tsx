import type { Annotation } from '@epam/ai-dial-chat-shared';
import { DialTooltip } from '@epam/ai-dial-ui-kit';
import { FC, memo, useCallback } from 'react';
import type { AnnotationGroup } from '../../../utils/group-annotations-by-source';
import CitationMarker from '../CitationMarker/CitationMarker';
import CitationPopup from '../CitationPopup/CitationPopup';

interface Props {
  /** The annotation group represented by this marker+popup pair. */
  group: AnnotationGroup;
  /** Whether this group's popup is currently open. */
  isOpen: boolean;
  /** Zero-based index of the currently visible annotation inside the popup. */
  activeIndex: number;
  /** Called when the popup should open. */
  onOpen: () => void;
  /** Called when the popup should close. */
  onClose: () => void;
  /** Called when the user navigates within the group switcher. */
  onIndexChange: (index: number) => void;
  /** Called when the user clicks "Preview" for an annotation. */
  onPreview: (annotation: Annotation) => void;
  /** Called when the user clicks "Open in browser" for an annotation. */
  onOpenInBrowser: (annotation: Annotation) => void;
}

const CitationDropdown: FC<Props> = ({
  group,
  isOpen,
  activeIndex,
  onOpen,
  onClose,
  onIndexChange,
  onPreview,
  onOpenInBrowser,
}) => {
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) onClose();
    },
    [onClose],
  );

  return (
    <DialTooltip
      open={isOpen}
      onOpenChange={handleOpenChange}
      placement="bottom-end"
      triggerClassName="ms-1 inline-flex align-middle"
      contentClassName="!p-0 !bg-transparent !border-0 !shadow-none !max-w-none !rounded-none"
      tooltip={
        <CitationPopup
          group={group}
          activeIndex={activeIndex}
          onIndexChange={onIndexChange}
          onPreview={onPreview}
          onOpenInBrowser={onOpenInBrowser}
        />
      }
    >
      <CitationMarker
        sourceName={group.sourceName}
        annotationCount={group.annotations.length}
        onOpen={onOpen}
      />
    </DialTooltip>
  );
};

export default memo(CitationDropdown);

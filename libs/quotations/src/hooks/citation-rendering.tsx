import type { ReactNode } from 'react';
import { CitationDropdown } from '../components/CitationDropdown/CitationDropdown';
import type { AnnotationGroup } from '../utils/group-annotations-by-source';
import type { UseCitationMarkdownComponentsCallbacks } from './useCitationMarkdownComponents/useCitationMarkdownComponents';

/** Renders a `<cit>` element as the literal markup it was written as. */
export const renderCitTagAsText = (
  dataId: string | undefined,
  children: ReactNode,
) => (
  <>
    {dataId == null ? '<cit>' : `<cit data-id="${dataId}">`}
    {children}
    {'</cit>'}
  </>
);

/** Returns a function that renders a group's `CitationDropdown` with the host's callbacks and labels. */
export const createCitationGroupRenderer = ({
  onPreview,
  isPreviewable,
  onOpenInBrowser,
  isDownloadEnabled = true,
  isPreviewOpen = false,
  previewFilesOnMarkerClick = false,
  buildLabels,
}: UseCitationMarkdownComponentsCallbacks) => {
  const renderGroup = (group: AnnotationGroup) => {
    const { cardLabels, markerLabels } = buildLabels(group);

    return (
      <CitationDropdown
        key={`citation-${group.groupKey}`}
        group={group}
        onPreview={(annotation) => onPreview(annotation, group)}
        isPreviewable={isPreviewable}
        onOpenInBrowser={onOpenInBrowser}
        isDownloadEnabled={isDownloadEnabled}
        isPreviewOpen={isPreviewOpen}
        previewFilesOnMarkerClick={previewFilesOnMarkerClick}
        cardLabels={cardLabels}
        markerLabels={markerLabels}
      />
    );
  };
  return renderGroup;
};

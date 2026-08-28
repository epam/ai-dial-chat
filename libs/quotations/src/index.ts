// Components
export { CitationCard } from './components/CitationCard/CitationCard';
export type {
  CitationCardLabels,
  CitationCardProps,
  CitationCardTypography,
} from './components/CitationCard/CitationCard';

export { CitationMarker } from './components/CitationMarker/CitationMarker';
export type {
  CitationMarkerLabels,
  CitationMarkerProps,
} from './components/CitationMarker/CitationMarker';

export { CitationDropdown } from './components/CitationDropdown/CitationDropdown';
export type { CitationDropdownProps } from './components/CitationDropdown/CitationDropdown';

// Context
export {
  CitationCardProvider,
  useCitationCardContext,
} from './context/CitationCardContext';
export type { CitationCardHook } from './context/CitationCardContext';

// Hooks
export { useAnnotations } from './utils/useAnnotations';
export { useCitationCard } from './utils/useCitationCard';
export { useCitationMarkdownComponents } from './hooks/useCitationMarkdownComponents/useCitationMarkdownComponents';
export type { UseCitationMarkdownComponentsCallbacks } from './hooks/useCitationMarkdownComponents/useCitationMarkdownComponents';

// Utils
export { groupAnnotationsBySource } from './utils/group-annotations-by-source';
export type { AnnotationGroup } from './utils/group-annotations-by-source';

export {
  annotationsToPdfHighlights,
  annotationHighlightId,
  normalizeRawAnnotations,
  resolveMessageAnnotations,
} from './utils/annotation';

export {
  injectCitationSentinels,
  replaceSentinelsInChildren,
} from './utils/citation-injection';

export {
  isReferenceOnlyAttachment,
  parsePdfPageReference,
  getReferenceAttachmentGroups,
} from './utils/reference-attachment';
export type { PdfPageReference } from './utils/reference-attachment';

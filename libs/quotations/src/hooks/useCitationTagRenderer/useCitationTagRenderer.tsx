import { useMemo, type ReactNode } from 'react';
import { buildCitGroupsByTagId } from '../../utils/citation-injection';
import type { AnnotationGroup } from '../../utils/group-annotations-by-source';
import {
  createCitationGroupRenderer,
  renderCitTagAsText,
} from '../citation-rendering';
import type { UseCitationMarkdownComponentsCallbacks } from '../useCitationMarkdownComponents/useCitationMarkdownComponents';

/*
 * Shared empty array for callers that omit `fallbackGroups`: a default
 * parameter value is a fresh `[]` on every call, which would break the
 * renderer memo on every re-render even when nothing changed.
 */
const EMPTY_FALLBACK_GROUPS: AnnotationGroup[] = [];

/**
 * Returns a renderer for `<cit data-id="…">` elements only — the citation
 * dropdown for a claimed id, the literal markup otherwise.
 *
 * Exists for markdown surfaces other than the message body (e.g. stage
 * content): unlike `useCitationMarkdownComponents` it returns no `p`/`li`
 * overrides, so the surface keeps its own typography, and it never resolves
 * offset-based groups, whose offsets point into the message text. `groups`
 * win over `fallbackGroups` on a colliding id.
 */
export const useCitationTagRenderer = (
  groups: AnnotationGroup[],
  callbacks: UseCitationMarkdownComponentsCallbacks,
  fallbackGroups: AnnotationGroup[] = EMPTY_FALLBACK_GROUPS,
): ((dataId: string | undefined, children: ReactNode) => ReactNode) => {
  const {
    onPreview,
    isPreviewable,
    onOpenInBrowser,
    isDownloadEnabled,
    isPreviewOpen,
    previewFilesOnMarkerClick,
    buildLabels,
  } = callbacks;

  return useMemo(() => {
    const citGroupsByTagId = buildCitGroupsByTagId(groups, fallbackGroups);
    const renderGroup = createCitationGroupRenderer({
      onPreview,
      isPreviewable,
      onOpenInBrowser,
      isDownloadEnabled,
      isPreviewOpen,
      previewFilesOnMarkerClick,
      buildLabels,
    });

    return (dataId: string | undefined, children: ReactNode) => {
      const group = dataId != null ? citGroupsByTagId.get(dataId) : undefined;
      return group ? renderGroup(group) : renderCitTagAsText(dataId, children);
    };
  }, [
    groups,
    fallbackGroups,
    onPreview,
    isPreviewable,
    onOpenInBrowser,
    isDownloadEnabled,
    isPreviewOpen,
    previewFilesOnMarkerClick,
    buildLabels,
  ]);
};

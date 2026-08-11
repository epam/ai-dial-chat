import { BASE_LG_ICON_PROPS } from '@epam/ai-dial-chat-shared';
import {
  PanelNoResults,
  SearchInput,
  SidebarOrientation,
  SidebarPanel,
} from '@epam/ai-dial-sidebar';
import { DialNoDataContent, GhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconDownload } from '@tabler/icons-react';
import {
  memo,
  useLayoutEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import type { ConversationSourcesPanelProps } from '../../models/conversation-sources-panel-props';
import FilesSection from '../FilesSection/FilesSection';
import SourcesSection from '../SourcesSection/SourcesSection';

const includesIgnoreCase = (text: string, query: string): boolean =>
  text.toLowerCase().includes(query.toLowerCase());

/** Resizable sidebar panel listing a conversation's uploaded/generated attachments and cited sources, with search and filtering. */
const ConversationSourcesPanel: FC<ConversationSourcesPanelProps> = ({
  isOpen,
  onClose,
  uploaded,
  generated,
  sources,
  onAttachmentClick,
  onSourceClick,
  onDownloadAll,
  isMobile,
  defaultWidth,
  minWidth,
  maxWidth,
  onResizeStop,
  labels,
  styles,
  title,
  additionalSections,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  useLayoutEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredUploaded = useMemo(
    () =>
      searchQuery
        ? uploaded.filter((att) => includesIgnoreCase(att.name, searchQuery))
        : uploaded,
    [uploaded, searchQuery],
  );

  const filteredGenerated = useMemo(
    () =>
      searchQuery
        ? generated.filter((att) => includesIgnoreCase(att.name, searchQuery))
        : generated,
    [generated, searchQuery],
  );

  const filteredSources = useMemo(
    () =>
      searchQuery
        ? sources.filter(
            (s) =>
              includesIgnoreCase(s.title, searchQuery) ||
              includesIgnoreCase(s.url, searchQuery) ||
              (s.quote != null && includesIgnoreCase(s.quote, searchQuery)),
          )
        : sources,
    [sources, searchQuery],
  );

  const hasFilesOrSources =
    uploaded.length > 0 || generated.length > 0 || sources.length > 0;
  /*
   * `additionalSections` (e.g. a host's scheduled-task History/Details
   * accordions) counts as non-empty content even when there are no files or
   * sources — this component has no knowledge of what it renders, only that
   * its presence means the panel isn't empty.
   */
  const isGloballyEmpty = !hasFilesOrSources && !additionalSections;
  const isNoResults =
    searchQuery !== '' &&
    filteredUploaded.length === 0 &&
    filteredGenerated.length === 0 &&
    filteredSources.length === 0;

  let bodyContent: ReactNode;
  if (isGloballyEmpty) {
    bodyContent = (
      <div className="flex h-full items-center justify-center">
        <DialNoDataContent title={labels.noDataLabel} />
      </div>
    );
  } else {
    bodyContent = (
      <>
        {additionalSections}
        {isNoResults ? (
          <PanelNoResults label={labels.noResultsLabel} />
        ) : (
          <>
            <FilesSection
              attachments={filteredUploaded}
              title={labels.uploadedSectionTitle}
              searchQuery={searchQuery}
              titleClassName={styles?.typography?.sectionTitleClassName}
              onAttachmentClick={onAttachmentClick}
              attachmentClickLabel={labels.attachmentClickLabel}
            />
            <FilesSection
              attachments={filteredGenerated}
              title={labels.generatedSectionTitle}
              searchQuery={searchQuery}
              titleClassName={styles?.typography?.sectionTitleClassName}
              onAttachmentClick={onAttachmentClick}
              attachmentClickLabel={labels.attachmentClickLabel}
            />
            <SourcesSection
              sources={filteredSources}
              title={labels.sourcesSectionTitle}
              searchQuery={searchQuery}
              typography={styles?.typography}
              colors={styles?.colors}
              copyLabel={labels.copySourceLabel}
              copiedLabel={labels.sourceCopiedLabel}
              onSourceClick={onSourceClick}
            />
          </>
        )}
      </>
    );
  }

  return (
    <SidebarPanel
      isOpen={isOpen}
      orientation={SidebarOrientation.Right}
      styles={{
        className: isMobile && isOpen ? 'w-full' : undefined,
        bodyClassName: 'flex flex-col overflow-hidden p-0',
        headerClassName: 'border-b border-tertiary',
      }}
      labels={labels}
      title={title}
      onClose={onClose}
      resizable={!isMobile}
      defaultWidth={defaultWidth}
      minWidth={minWidth}
      maxWidth={maxWidth}
      onResizeStop={onResizeStop}
      rightActions={
        hasFilesOrSources && (
          <GhostIconButton
            icon={<IconDownload {...BASE_LG_ICON_PROPS} />}
            aria-label={labels.downloadAllLabel}
            tooltipProps={{ tooltip: labels.downloadAllLabel }}
            onClick={onDownloadAll}
            disabled={!onDownloadAll}
          />
        )
      }
    >
      {hasFilesOrSources && (
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          labels={{
            placeholder: labels.searchPlaceholder,
            clearLabel: labels.searchClearLabel,
          }}
        />
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {isNoResults ? labels.noResultsLabel : ''}
      </span>
      <div className="flex-1 overflow-y-auto p-4">{bodyContent}</div>
    </SidebarPanel>
  );
};

export default memo(ConversationSourcesPanel);

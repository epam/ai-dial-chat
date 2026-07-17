import {
  PanelEmpty,
  PanelNoResults,
  SearchInput,
  SidebarOrientation,
  SidebarPanel,
} from '@epam/ai-dial-sidebar';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconDownload } from '@tabler/icons-react';
import { memo, useLayoutEffect, useMemo, useState, type FC } from 'react';
import type { ConversationSourcesPanelProps } from '../../models/conversation-sources-panel-props';
import FilesSection from '../FilesSection/FilesSection';
import SourcesSection from '../SourcesSection/SourcesSection';
export type {
  ConversationSourcesPanelColors,
  ConversationSourcesPanelLabels,
  ConversationSourcesPanelProps,
  ConversationSourcesPanelStyles,
  ConversationSourcesPanelTypography,
} from '../../models/conversation-sources-panel-props';

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

  const isEmpty =
    uploaded.length === 0 && generated.length === 0 && sources.length === 0;
  const isNoResults =
    searchQuery !== '' &&
    filteredUploaded.length === 0 &&
    filteredGenerated.length === 0 &&
    filteredSources.length === 0;

  return (
    <SidebarPanel
      isOpen={isOpen}
      orientation={SidebarOrientation.Right}
      styles={{
        className: isOpen ? 'mobile:w-full' : 'w-0',
        bodyClassName: 'flex flex-col overflow-hidden p-0',
      }}
      labels={labels}
      onClose={onClose}
      resizable={!isMobile}
      defaultWidth={defaultWidth}
      minWidth={minWidth}
      maxWidth={maxWidth}
      onResizeStop={onResizeStop}
      rightActions={
        !isEmpty && (
          <DialGhostIconButton
            icon={
              <IconDownload size={DIAL_ICON_SIZE.LG} stroke={1.5} aria-hidden />
            }
            aria-label={labels.downloadAllLabel}
            tooltipProps={{ tooltip: labels.downloadAllLabel }}
            onClick={onDownloadAll}
            disabled={!onDownloadAll}
          />
        )
      }
    >
      {!isEmpty && (
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
      <div className="flex-1 overflow-y-auto p-4">
        {isEmpty ? (
          <PanelEmpty label={labels.emptyLabel} />
        ) : isNoResults ? (
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
              titleClassName={styles?.typography?.sectionTitleClassName}
              linkClassName={styles?.typography?.sourceLinkClassName}
              quoteClassName={styles?.typography?.sourceQuoteClassName}
              colors={{
                link: styles?.colors?.sourceLink,
                quote: styles?.colors?.sourceQuote,
              }}
              copyLabel={labels.copySourceLabel}
              onSourceClick={onSourceClick}
            />
          </>
        )}
      </div>
    </SidebarPanel>
  );
};

export default memo(ConversationSourcesPanel);

import { mergeClasses, PanelEmptyState } from '@epam/ai-dial-chat-shared';
import {
  LiveRegion,
  LiveRegionElement,
  Skeleton,
  Tabs,
} from '@epam/ai-dial-ui-kit';
import { type FC, useMemo } from 'react';
import type { ToolsLabels } from '../../models/item-details-data';
import type { DetailsPanelProps } from '../../models/item-details-props';
import { CatalogDetailsTab } from '../../types/detail-tab';
import { hasConnectableApi } from '../../utils/details-tabs';
import { getCatalogMarkdownLabels } from '../../utils/item-details-texts';
import { ApiDetails } from './ApiDetails';
import styles from './DetailsPanel.module.scss';
import type { useDetailsContentFile } from './hooks/useDetailsContentFile';
import { AboutTab } from './TabsContent/About';
import { ContentTab } from './TabsContent/Content';
import { LimitsTab } from './TabsContent/Limits/Limits';
import { Overview } from './TabsContent/Overview';
import { Pricing } from './TabsContent/Pricing';
import { Tools } from './TabsContent/Tools/Tools';

/** Props for {@link DetailsTabs}. */
export interface DetailsTabsProps extends Pick<
  DetailsPanelProps,
  | 'item'
  | 'isDetailsLoading'
  | 'renderContentFileTree'
  | 'texts'
  | 'limitsFooterNote'
> {
  /** Tabs this item shows, in order. */
  tabs: { id: CatalogDetailsTab; label: string }[];
  /** Id of the selected tab. */
  activeTab: string;
  /** Called with the id of the tab the user selects. */
  onTabChange: (tabId: string) => void;
  /** Content-tab file picker state, from `useDetailsContentFile`. */
  contentFile: ReturnType<typeof useDetailsContentFile>;
  /** Style overrides of the details panel. */
  detailsStyles: DetailsPanelProps['styles'];
}

/** Tab row and active tab body of the catalog details panel. */
export const DetailsTabs: FC<DetailsTabsProps> = ({
  item,
  tabs,
  activeTab,
  onTabChange,
  isDetailsLoading = false,
  contentFile,
  renderContentFileTree,
  texts,
  detailsStyles,
  limitsFooterNote,
}) => {
  const {
    overviewSectionClassName = 'dial-caption-text',
    overviewLabelClassName = 'dial-small-semi-text',
    overviewValueClassName = 'dial-small-text',
    overviewValueTrueClassName = 'dial-small-text',
  } = detailsStyles?.typography ?? {};
  const {
    promptContent,
    selectedFileId,
    isContentFileLoading,
    expandedFolderIds,
    isFileSelectorOpen,
    setIsFileSelectorOpen,
    handleToggleFolder,
    handleSelectContentFile,
    resolveContentFilePreview,
    renderedContentFilePreview,
  } = contentFile;

  const markdownLabels = useMemo(
    () => getCatalogMarkdownLabels(texts),
    [texts],
  );

  // Only the strings the host set: an `undefined` would override the tab's English default.
  const toolsLabels = useMemo(() => {
    const labels: Partial<ToolsLabels> = {};
    if (texts?.toolsSearchPlaceholder != null)
      labels.searchPlaceholder = texts.toolsSearchPlaceholder;
    if (texts?.toolsSearchClearLabel != null)
      labels.searchClearLabel = texts.toolsSearchClearLabel;
    if (texts?.toolsCountLabel != null)
      labels.toolCount = texts.toolsCountLabel;
    if (texts?.toolsNoResultsLabel != null)
      labels.noResults = texts.toolsNoResultsLabel;
    return labels;
  }, [texts]);

  const emptyTabLabel = texts?.emptyTabLabel ?? 'No data';
  const isAboutEmpty =
    !item.description?.trim() && (item.topics?.length ?? 0) === 0;
  const isOverviewEmpty = !item.details?.overview?.sections?.length;
  const emptyTabState = (
    <div className="flex size-full items-center justify-center py-6">
      <PanelEmptyState label={emptyTabLabel} />
    </div>
  );

  const overviewYesLabel = texts?.overviewYesLabel ?? 'Yes';
  const overviewNoLabel = texts?.overviewNoLabel ?? 'No';

  return (
    <>
      <div className="flex items-center px-6">
        {/* The tab row scrolls on its own so a narrow panel never scrolls sideways as a whole. */}
        <Tabs
          tabs={tabs}
          activeTabId={activeTab}
          onTabChange={onTabChange}
          className={mergeClasses(
            'min-w-0 flex-1 overflow-x-auto',
            styles.tabsScroll,
          )}
          tabClassName="shrink-0"
        />
        {/* Always mounted, so the loading text is announced when fetching starts. */}
        <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
          {isDetailsLoading
            ? (texts?.detailsLoadingAriaLabel ?? 'Loading details')
            : ''}
        </LiveRegion>
        {isDetailsLoading && (
          <div aria-hidden className="shrink-0">
            <Skeleton
              showTitle={false}
              paragraph={{ rows: 1, width: '72px' }}
              active
              color={styles.skeletonColor}
            />
          </div>
        )}
      </div>

      <div
        className={mergeClasses(
          'min-h-0 min-w-0 flex-1',
          activeTab === CatalogDetailsTab.Content
            ? 'overflow-hidden'
            : 'overflow-y-auto',
          /* The Content tab pads its own sections so its divider spans the full width. */
          activeTab !== CatalogDetailsTab.Overview &&
            activeTab !== CatalogDetailsTab.Content &&
            'px-6',
        )}
      >
        {activeTab === CatalogDetailsTab.About && isAboutEmpty
          ? emptyTabState
          : null}
        {activeTab === CatalogDetailsTab.About && !isAboutEmpty && (
          <AboutTab
            content={item.description}
            topics={item.topics}
            detailsStyles={detailsStyles}
            markdownLabels={markdownLabels}
          />
        )}
        {activeTab === CatalogDetailsTab.Content && (
          <ContentTab
            content={promptContent?.content ?? ''}
            filePreview={resolveContentFilePreview()}
            filePreviewContent={renderedContentFilePreview}
            renderFileTree={renderContentFileTree}
            description={promptContent?.description ?? item.description}
            files={promptContent?.files}
            selectedFileId={selectedFileId}
            onSelectFile={(fileId) => void handleSelectContentFile(fileId)}
            isFileLoading={isContentFileLoading}
            expandedFolderIds={expandedFolderIds}
            onToggleFolder={handleToggleFolder}
            isFileSelectorOpen={isFileSelectorOpen}
            onFileSelectorOpenChange={setIsFileSelectorOpen}
            fileSelectorAriaLabel={texts?.contentFileSelectorAriaLabel}
            fileCountLabel={texts?.contentFileCountLabel}
            fileLoadingLabel={texts?.contentFileLoadingLabel}
            fileUnsupportedLabel={texts?.contentFileUnsupportedLabel}
            detailsStyles={detailsStyles}
            markdownLabels={markdownLabels}
          />
        )}
        {activeTab === CatalogDetailsTab.Overview && isOverviewEmpty
          ? emptyTabState
          : null}
        {activeTab === CatalogDetailsTab.Overview && !isOverviewEmpty && (
          <Overview
            sections={item.details?.overview?.sections}
            sectionClassName={overviewSectionClassName}
            labelClassName={overviewLabelClassName}
            valueClassName={overviewValueClassName}
            valueTrueClassName={overviewValueTrueClassName}
            yesLabel={overviewYesLabel}
            noLabel={overviewNoLabel}
          />
        )}
        {activeTab === CatalogDetailsTab.Pricing && (
          <Pricing
            pricing={item.details?.pricing}
            pricesSectionLabel={texts?.pricingPricesSectionLabel}
            characterPricesSectionLabel={
              texts?.pricingCharacterPricesSectionLabel
            }
            limitsSectionLabel={texts?.pricingLimitsSectionLabel}
          />
        )}
        {activeTab === CatalogDetailsTab.Limits && (
          <LimitsTab
            limits={item.details?.limits}
            footerNote={limitsFooterNote}
          />
        )}
        {activeTab === CatalogDetailsTab.Api &&
          hasConnectableApi(item.details?.api) && (
            <ApiDetails
              api={item.details?.api}
              resourceSectionLabel={texts?.apiResourceSectionLabel}
              snippetSectionLabel={texts?.apiSnippetSectionLabel}
              modelIdLabel={texts?.apiModelIdLabel}
              endpointLabel={texts?.apiEndpointLabel}
              endpointSectionLabel={texts?.apiEndpointSectionLabel}
              requestExampleLabel={texts?.apiRequestExampleLabel}
              responseSchemaLabel={texts?.apiResponseSchemaLabel}
              copyAriaLabel={texts?.copyCodeAriaLabel}
              copiedStatusLabel={texts?.copiedCodeStatusLabel}
            />
          )}
        {activeTab === CatalogDetailsTab.Tools && (
          <Tools tools={item.details?.tools} labels={toolsLabels} />
        )}
      </div>
    </>
  );
};

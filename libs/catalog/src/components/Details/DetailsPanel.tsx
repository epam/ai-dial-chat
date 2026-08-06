import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { TabRow } from '@epam/ai-dial-kit';
import {
  derivePublishState,
  PublishFooter,
  PublishPanel,
  usePublishFlow,
} from '@epam/ai-dial-publish-panel';
import type {
  PublishFolderNode,
  PublishHistoryEntry,
} from '@epam/ai-dial-publish-panel';
import {
  DialCloseButton,
  DialConfirmationPopup,
  DialSkeleton,
  DialTag,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronLeft } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import type { CatalogItem } from '../../models/catalog-item';
import type { DetailsPanelProps } from '../../models/item-details-props';
import { CatalogDetailsTab } from '../../types/detail-tab';
import { getSignedInLevel } from '../../utils/toolset-credentials';
import { EntityHeader } from '../EntityHeader/EntityHeader';
import { StarToggleButton } from '../StarToggleButton/StarToggleButton';
import { ApiDetails } from './ApiDetails';
import { CredentialsSection } from './Credentials/CredentialsSection';
import styles from './DetailsPanel.module.scss';
import { Header } from './Header/Header';
import { Summary } from './Summary/Summary';
import { AboutTab } from './TabsContent/About';
import { LimitsTab } from './TabsContent/Limits';
import { Overview } from './TabsContent/Overview';
import { Pricing } from './TabsContent/Pricing';
import { Tools } from './TabsContent/Tools/Tools';

const NO_OP_PUBLISH = async () => undefined;
const EMPTY_PUBLISH_FOLDERS: PublishFolderNode[] = [];
const EMPTY_RULE_SOURCE_OPTIONS: string[] = [];

/** Right-side slide-in panel displaying full details for a catalog item. */
export const DetailsPanel: FC<DetailsPanelProps> = ({
  item,
  isOpen,
  isStarred: initialIsStarred = false,
  isDetailsLoading = false,
  onClose,
  onToggleFavorite,
  onUseInChat,
  isPrimaryActionVisible,
  onShare,
  isPublishVisible,
  getPublishHistory,
  publishFolderItems = EMPTY_PUBLISH_FOLDERS,
  publishExpandedPaths,
  onPublishExpandedPathsChange,
  publishLoadingPaths,
  hasPublishWriteAccess,
  onPublish,
  onPublishSuccess,
  onPublishError,
  onCreatePublishFolder,
  publishLabels,
  ruleSourceOptions = EMPTY_RULE_SOURCE_OPTIONS,
  onFetchExistingRules,
  shareOverlay,
  isShareVisible,
  onEdit,
  onDelete,
  onLogin,
  onLogout,
  texts,
  styles: detailsStyles,
}) => {
  const {
    overviewSectionClassName = 'dial-caption-text',
    overviewLabelClassName = 'dial-small-semi-text',
    overviewValueClassName = 'dial-small-text',
    overviewValueTrueClassName = 'dial-small-text',
    credentialsStatusLabelClassName,
  } = detailsStyles?.typography ?? {};

  const detailsColors = detailsStyles?.colors;
  const limitColors = detailsColors?.limits;
  /* Set on both the backdrop and the panel — they are siblings, not nested. */
  const cssVars = buildCssVars({
    '--cat-details-backdrop': detailsColors?.backdrop,
    '--cat-details-bg': detailsColors?.background,
    '--cat-details-border': detailsColors?.border,
    '--cat-details-divider': detailsColors?.divider,
    '--cat-details-scrollbar': detailsColors?.scrollbar,
    '--cat-details-skeleton': detailsColors?.skeleton,
    '--cat-details-name-text': detailsColors?.nameText,
    '--cat-details-publish-title-text': detailsColors?.publishTitleText,
    '--cat-details-version-tag-border': detailsColors?.versionTagBorder,
    '--cat-details-version-tag-bg': detailsColors?.versionTagBackground,
    '--cat-details-version-tag-text': detailsColors?.versionTagText,
    '--cat-credentials-status-text': detailsColors?.credentialsStatusText,
    '--cat-api-heading-text': detailsColors?.apiHeadingText,
    '--cat-tools-divider': detailsColors?.toolsDivider,
    '--cat-tools-description-text': detailsColors?.toolsDescriptionText,
    '--cat-grid-border': detailsColors?.gridBorder,
    '--cat-grid-header-text': detailsColors?.gridHeaderText,
    '--cat-grid-header-bg': detailsColors?.gridHeaderBackground,
    '--cat-grid-cell-text': detailsColors?.gridCellText,
    '--cat-grid-cell-divider': detailsColors?.gridCellDivider,
    '--cat-grid-row-even-bg': detailsColors?.gridRowEvenBackground,
    '--cat-limits-free-bg': limitColors?.freeBackground,
    '--cat-limits-free-text': limitColors?.freeText,
    '--cat-limits-featured-bg': limitColors?.featuredBackground,
    '--cat-limits-featured-text': limitColors?.featuredText,
    '--cat-limits-by-request-bg': limitColors?.byRequestBackground,
    '--cat-limits-by-request-text': limitColors?.byRequestText,
    '--cat-limits-beta-bg': limitColors?.betaBackground,
    '--cat-limits-beta-text': limitColors?.betaText,
    '--cat-limits-deprecated-bg': limitColors?.deprecatedBackground,
    '--cat-limits-deprecated-text': limitColors?.deprecatedText,
    '--cat-limits-progress-track': limitColors?.progressTrack,
    '--cat-limits-progress-fill': limitColors?.progressFill,
    '--cat-limits-reset-text': limitColors?.resetText,
  });

  const [isStarred, setIsStarred] = useState(initialIsStarred);
  const [activeTab, setActiveTab] = useState<string>('');
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [publishHistory, setPublishHistory] = useState<PublishHistoryEntry[]>(
    [],
  );
  const [isPublishHistoryLoading, setIsPublishHistoryLoading] = useState(false);
  const [hasPublishHistoryError, setHasPublishHistoryError] = useState(false);

  useEffect(() => {
    if (!isPublishOpen || !getPublishHistory) {
      return;
    }
    let isCancelled = false;
    setIsPublishHistoryLoading(true);
    setHasPublishHistoryError(false);
    getPublishHistory(item)
      .then((entries) => {
        if (!isCancelled) setPublishHistory(entries);
      })
      .catch(() => {
        if (!isCancelled) setHasPublishHistoryError(true);
      })
      .finally(() => {
        if (!isCancelled) setIsPublishHistoryLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [isPublishOpen, getPublishHistory, item]);

  const publishFlow = usePublishFlow<CatalogItem>({
    item,
    history: publishHistory,
    folderItems: publishFolderItems,
    hasWriteAccess: hasPublishWriteAccess,
    onCreateFolder: onCreatePublishFolder,
    onPublish: onPublish ?? NO_OP_PUBLISH,
    onPublishSuccess,
    onPublishError,
    onFetchExistingRules,
  });

  const publishDerived = useMemo(
    () =>
      derivePublishState({
        hasSelectedFolder: publishFlow.selectedFolderPath != null,
        hasExistingPublicationInFolder:
          publishFlow.hasExistingPublicationInFolder,
        hasWriteAccess: publishFlow.hasWriteAccess,
        isSubmitting: publishFlow.isSubmitting,
        hasSubmitError: publishFlow.hasSubmitError,
      }),
    [
      publishFlow.selectedFolderPath,
      publishFlow.hasExistingPublicationInFolder,
      publishFlow.hasWriteAccess,
      publishFlow.isSubmitting,
      publishFlow.hasSubmitError,
    ],
  );
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [isDirectLogoutConfirmOpen, setIsDirectLogoutConfirmOpen] =
    useState(false);

  useEffect(() => {
    setIsStarred(initialIsStarred);
  }, [item.id, initialIsStarred]);

  useEffect(() => {
    setActiveTab(CatalogDetailsTab.About);
    setIsPublishOpen(false);
    publishFlow.reset();
    setPublishHistory([]);
    setHasPublishHistoryError(false);
    setIsCredentialsOpen(false);
    setIsDirectLogoutConfirmOpen(false);
    // Reset publish-flow-local state only when the displayed item changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const handleToggleCredentials = useCallback(() => {
    setIsCredentialsOpen((prev) => !prev);
  }, []);

  const handleRequestLogout = useCallback(() => {
    setIsDirectLogoutConfirmOpen(true);
  }, []);

  const handleCancelDirectLogout = useCallback(() => {
    setIsDirectLogoutConfirmOpen(false);
  }, []);

  const handleConfirmDirectLogout = useCallback(() => {
    setIsDirectLogoutConfirmOpen(false);
    if (item.credentials == null) return;
    onLogout?.(item, { level: getSignedInLevel(item.credentials) });
  }, [item, onLogout]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleOpenPublish = useCallback(() => setIsPublishOpen(true), []);
  const handleClosePublish = useCallback(() => {
    setIsPublishOpen(false);
    publishFlow.reset();
  }, [publishFlow]);
  const handleSubmitPublish = useCallback(async () => {
    const isSuccess = await publishFlow.handleSubmit();
    if (isSuccess) {
      handleClosePublish();
    }
  }, [publishFlow, handleClosePublish]);

  const handleToggleFavorite = useCallback(() => {
    const next = !isStarred;
    setIsStarred(next);
    onToggleFavorite?.(item.id, next);
  }, [isStarred, item.id, onToggleFavorite]);

  const tabs = useMemo(() => {
    const result: { id: string; label: string }[] = [
      { id: CatalogDetailsTab.About, label: texts?.tabAboutLabel ?? 'About' },
    ];
    if (item.details?.overview != null) {
      result.push({
        id: CatalogDetailsTab.Overview,
        label: texts?.tabOverviewLabel ?? 'Overview',
      });
    }
    if (item.details?.pricing != null) {
      result.push({
        id: CatalogDetailsTab.Pricing,
        label: texts?.tabPricingLabel ?? 'Pricing',
      });
    }
    if (item.details?.limits != null) {
      result.push({
        id: CatalogDetailsTab.Limits,
        label: texts?.tabLimitsLabel ?? 'Limits',
      });
    }
    if (item.details?.tools != null) {
      result.push({
        id: CatalogDetailsTab.Tools,
        label: texts?.tabToolsLabel ?? 'Tools',
      });
    }
    /*
     * Connect is pushed last, after every other tab, regardless of type. It
     * needs a connectable endpoint URL to be worth showing: items whose api
     * data is only a resource identifier (a model's `modelId`) have nothing
     * to connect to.
     */
    if (item.details?.api?.resource?.endpointUrl != null) {
      result.push({
        id: CatalogDetailsTab.Api,
        label: texts?.tabConnectLabel ?? 'Connect',
      });
    }
    return result;
  }, [item, texts]);

  // Reset to the first available tab when the item changes or the active
  // tab is no longer in the (possibly newly-fetched) available list.
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? '');
    }
  }, [item.id, tabs, activeTab]);

  const overviewYesLabel = texts?.overviewYesLabel ?? 'Yes';
  const overviewNoLabel = texts?.overviewNoLabel ?? 'No';

  const panelAriaLabel = texts?.ariaLabel ?? 'Item details';
  const closeAriaLabel = texts?.closeAriaLabel ?? 'Close';
  const starAriaLabel = isStarred
    ? (texts?.removeFromFavoritesAriaLabel ?? 'Remove from favorites')
    : (texts?.addToFavoritesAriaLabel ?? 'Add to favorites');
  const publishTitle = texts?.publishTitle ?? 'Publish';
  const backToDetailsAriaLabel = texts?.backToDetailsAriaLabel ?? 'Back';

  return (
    <>
      <div
        style={cssVars}
        className={mergeClasses(
          'fixed inset-0 z-40 transition-opacity duration-300',
          styles.backdrop,
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={panelAriaLabel}
        style={cssVars}
        className={mergeClasses(
          'fixed inset-y-0 end-0 z-50 flex w-full flex-col overflow-hidden',
          'desktop:rounded-ts-xl desktop:rounded-bs-xl desktop:w-[540px] desktop:border-s',
          'transition-transform duration-300',
          styles.panel,
          isOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-center gap-2 px-[22px] py-3">
          {isPublishOpen ? (
            <>
              <GhostIconButton
                icon={<IconChevronLeft className="rtl:scale-x-[-1]" />}
                aria-label={backToDetailsAriaLabel}
                disabled={publishFlow.isSubmitting}
                onClick={handleClosePublish}
              />
              <span
                className={mergeClasses(
                  'dial-body-semi-text flex-1',
                  styles.publishTitle,
                )}
              >
                {publishTitle}
              </span>
            </>
          ) : (
            <>
              <div className="flex-1" />
              <StarToggleButton
                isStarred={isStarred}
                ariaLabel={starAriaLabel}
                onClick={handleToggleFavorite}
              />
            </>
          )}
          {!isPublishOpen && (
            <DialCloseButton onClose={onClose} ariaLabel={closeAriaLabel} />
          )}
        </div>

        <div className={mergeClasses('shrink-0', styles.divider)} />

        <div
          className={mergeClasses(
            'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto',
            styles.content,
          )}
        >
          {isPublishOpen ? (
            <div className="p-[22px]">
              <PublishPanel
                resource={{
                  title: item.name,
                  version: item.version,
                }}
                renderSummary={() => (
                  <>
                    <EntityHeader
                      item={item}
                      iconSize={40}
                      hasFeaturedTag={false}
                      showVersion={false}
                    />
                    <DialTag
                      label={`Version ${item.version} · current`}
                      className={mergeClasses(
                        'shrink-0 whitespace-nowrap',
                        styles.currentVersionTag,
                      )}
                    />
                  </>
                )}
                history={publishHistory}
                isHistoryLoading={isPublishHistoryLoading}
                hasHistoryError={hasPublishHistoryError}
                folderItems={publishFlow.folderItems}
                selectedFolderPath={publishFlow.selectedFolderPath}
                onSelectedFolderPathChange={publishFlow.setSelectedFolderPath}
                onCreateFolder={publishFlow.handleCreateFolder}
                expandedPaths={publishExpandedPaths}
                onExpandedPathsChange={onPublishExpandedPathsChange}
                loadingPaths={publishLoadingPaths}
                hasExistingPublicationInFolder={
                  publishFlow.hasExistingPublicationInFolder
                }
                hasWriteAccess={publishFlow.hasWriteAccess}
                isSubmitting={publishFlow.isSubmitting}
                hasSubmitError={publishFlow.hasSubmitError}
                rules={publishFlow.rules}
                onRulesChange={publishFlow.setRules}
                ruleSourceOptions={ruleSourceOptions}
                isRulesLoading={publishFlow.isRulesLoading}
                hasRulesLoadError={publishFlow.hasRulesLoadError}
                labels={publishLabels}
              />
            </div>
          ) : (
            <>
              <Header
                item={item}
                onUseInChat={onUseInChat}
                isPrimaryActionVisible={isPrimaryActionVisible}
                onShare={onShare}
                shareOverlay={shareOverlay}
                isShareVisible={isShareVisible}
                isPublishVisible={isPublishVisible}
                onOpenPublish={handleOpenPublish}
                onEdit={onEdit}
                onDelete={onDelete}
                onCloseDetails={onClose}
                onLogin={onLogin}
                onLogout={onLogout}
                onToggleCredentials={handleToggleCredentials}
                onRequestLogout={handleRequestLogout}
                texts={texts}
                detailsStyles={detailsStyles}
              />

              {isCredentialsOpen && (
                <CredentialsSection
                  item={item}
                  onLogin={onLogin}
                  onLogout={onLogout}
                  texts={texts}
                  statusLabelClassName={credentialsStatusLabelClassName}
                />
              )}

              <DialConfirmationPopup
                open={isDirectLogoutConfirmOpen}
                header={texts?.logoutActionLabel ?? 'Log out'}
                description={
                  texts?.logoutConfirmMessage ??
                  'Are you sure you want to log out?'
                }
                confirmLabel={texts?.logoutActionLabel ?? 'Log out'}
                onConfirm={handleConfirmDirectLogout}
                onCancel={handleCancelDirectLogout}
                onClose={handleCancelDirectLogout}
              />

              <div className={styles.divider} />

              <Summary item={item} texts={texts} />

              <div className="flex items-center gap-2 px-[22px]">
                <TabRow
                  tabs={tabs}
                  activeTabId={activeTab}
                  onTabChange={setActiveTab}
                />
                {isDetailsLoading && (
                  <div
                    role="status"
                    aria-label={
                      texts?.detailsLoadingAriaLabel ?? 'Loading details'
                    }
                    className="shrink-0"
                  >
                    <DialSkeleton
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
                  activeTab !== CatalogDetailsTab.Overview && 'px-[22px]',
                )}
              >
                {activeTab === CatalogDetailsTab.About && (
                  <AboutTab
                    content={item.description}
                    detailsStyles={detailsStyles}
                  />
                )}
                {activeTab === CatalogDetailsTab.Overview && (
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
                    limitsSectionLabel={texts?.pricingLimitsSectionLabel}
                  />
                )}
                {activeTab === CatalogDetailsTab.Limits && (
                  <LimitsTab limits={item.details?.limits} />
                )}
                {activeTab === CatalogDetailsTab.Api &&
                  item.details?.api?.resource?.endpointUrl != null && (
                    <ApiDetails
                      api={item.details.api}
                      resourceSectionLabel={texts?.apiResourceSectionLabel}
                      snippetSectionLabel={texts?.apiSnippetSectionLabel}
                      modelIdLabel={texts?.apiModelIdLabel}
                      endpointLabel={texts?.apiEndpointLabel}
                      endpointSectionLabel={texts?.apiEndpointSectionLabel}
                      requestExampleLabel={texts?.apiRequestExampleLabel}
                      responseSchemaLabel={texts?.apiResponseSchemaLabel}
                      copyAriaLabel={texts?.copyCodeAriaLabel}
                    />
                  )}
                {activeTab === CatalogDetailsTab.Tools && (
                  <Tools tools={item.details?.tools} />
                )}
              </div>
            </>
          )}
        </div>

        {isPublishOpen && (
          <PublishFooter
            version={item.version}
            hasExistingPublicationInFolder={
              publishFlow.hasExistingPublicationInFolder
            }
            isSubmitDisabled={publishDerived.isSubmitDisabled}
            isSubmitLoading={publishDerived.isSubmitLoading}
            onCancel={handleClosePublish}
            onSubmit={handleSubmitPublish}
            labels={publishLabels}
          />
        )}
      </div>
    </>
  );
};

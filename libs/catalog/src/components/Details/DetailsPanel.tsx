import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { GhostIconButton, TabRow } from '@epam/ai-dial-kit';
import {
  DialCloseButton,
  DialConfirmationPopup,
  DialSkeleton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronLeft } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import type { DetailsPanelProps } from '../../models/item-details-props';
import type {
  PublishFolderNode,
  PublishHistoryEntry,
} from '../../models/publish';
import { CatalogDetailsTab } from '../../types/detail-tab';
import { derivePublishState } from '../../utils/publish-state';
import { getSignedInLevel } from '../../utils/toolset-credentials';
import { usePublishFlow } from '../../utils/use-publish-flow';
import { PublishFooter } from '../PublishPanel/PublishFooter';
import { PublishPanel } from '../PublishPanel/PublishPanel';
import { StarToggleButton } from '../StarToggleButton/StarToggleButton';
import { ApiDetails } from './ApiDetails';
import { CredentialsSection } from './Credentials/CredentialsSection';
import styles from './DetailsPanel.module.scss';
import { Header } from './Header/Header';
import { Summary } from './Summary/Summary';
import { AboutTab } from './TabsContent/About';
import { Overview } from './TabsContent/Overview';
import { Pricing } from './TabsContent/Pricing';
import { Tools } from './TabsContent/Tools/Tools';

const NO_OP_PUBLISH = async () => undefined;
const EMPTY_PUBLISH_FOLDERS: PublishFolderNode[] = [];

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
  onUnshare,
  isPublishVisible,
  getPublishHistory,
  publishFolderItems = EMPTY_PUBLISH_FOLDERS,
  publishExpandedPaths,
  onPublishExpandedPathsChange,
  publishLoadingPaths,
  hasPublishWriteAccess,
  onPublish,
  onPublishSuccess,
  onCreatePublishFolder,
  publishTexts,
  shareOverlay,
  connectOverlay,
  isConnectVisible,
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

  const publishFlow = usePublishFlow({
    item,
    history: publishHistory,
    folderItems: publishFolderItems,
    hasWriteAccess: hasPublishWriteAccess,
    onCreateFolder: onCreatePublishFolder,
    onPublish: onPublish ?? NO_OP_PUBLISH,
    onPublishSuccess,
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
  const [isUnshareConfirmOpen, setIsUnshareConfirmOpen] = useState(false);
  const [isUnsharing, setIsUnsharing] = useState(false);

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
    setIsUnshareConfirmOpen(false);
    setIsUnsharing(false);
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

  const handleRequestUnshare = useCallback(() => {
    setIsUnshareConfirmOpen(true);
  }, []);

  const handleCancelUnshare = useCallback(() => {
    setIsUnshareConfirmOpen(false);
  }, []);

  const handleConfirmUnshare = useCallback(async () => {
    if (isUnsharing) return;
    setIsUnsharing(true);
    try {
      await onUnshare?.(item);
      setIsUnshareConfirmOpen(false);
      onClose();
    } catch {
      // Failure feedback (e.g. a notification) is the caller's
      // responsibility; the item stays visible and the panel stays open.
      setIsUnshareConfirmOpen(false);
    } finally {
      setIsUnsharing(false);
    }
  }, [isUnsharing, item, onUnshare, onClose]);

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
    if (item.details?.api != null) {
      result.push({
        id: CatalogDetailsTab.Api,
        label: texts?.tabApiLabel ?? 'API',
      });
    }
    if (item.details?.tools != null) {
      result.push({
        id: CatalogDetailsTab.Tools,
        label: texts?.tabToolsLabel ?? 'Tools',
      });
    }
    return result;
  }, [item.details, texts]);

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
              <span className="dial-body-semi-text flex-1 text-primary">
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
            'min-h-0 flex-1 overflow-y-auto',
            styles.content,
          )}
        >
          {isPublishOpen ? (
            <div className="p-[22px]">
              <PublishPanel
                item={item}
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
                texts={publishTexts}
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
                connectOverlay={connectOverlay}
                isConnectVisible={isConnectVisible}
                onUnshare={handleRequestUnshare}
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

              <DialConfirmationPopup
                open={isUnshareConfirmOpen}
                header={texts?.unshareConfirmTitle ?? 'Delete item?'}
                description={
                  texts?.unshareConfirmMessage?.(item.name) ??
                  `Delete "${item.name}" from your catalog? You'll need a new invitation to access it again.`
                }
                confirmLabel={texts?.unshareLabel ?? 'Delete'}
                cancelLabel={texts?.cancelLabel ?? 'Cancel'}
                isLoading={isUnsharing}
                onConfirm={handleConfirmUnshare}
                onCancel={handleCancelUnshare}
                onClose={handleCancelUnshare}
              />

              <div className={styles.divider} />

              <Summary
                item={item}
                texts={texts}
                detailsStyles={detailsStyles}
              />

              <div className="flex items-center gap-2 px-[22px]">
                <TabRow
                  tabs={tabs}
                  activeTabId={activeTab}
                  onTabChange={setActiveTab}
                  activeTabClassName="text-catalog-tab-active"
                  inactiveTabClassName="text-catalog-tab-inactive hover:text-catalog-tab-hover border-transparent"
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
                      color="var(--bg-layer-4)"
                    />
                  </div>
                )}
              </div>

              <div
                className={mergeClasses(
                  activeTab !== CatalogDetailsTab.Overview && 'px-[22px] py-4',
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
                {activeTab === CatalogDetailsTab.Api &&
                  item.details?.api != null && (
                    <ApiDetails
                      api={item.details.api}
                      resourceSectionLabel={texts?.apiResourceSectionLabel}
                      snippetSectionLabel={texts?.apiSnippetSectionLabel}
                      modelIdLabel={texts?.apiModelIdLabel}
                      endpointLabel={texts?.apiEndpointLabel}
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
            texts={publishTexts}
          />
        )}
      </div>
    </>
  );
};

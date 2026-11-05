import {
  ConfirmationFooter,
  ConfirmationView,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { PublishFooter } from '@epam/ai-dial-publish-panel';
import { RadioGroup, SideDrawer } from '@epam/ai-dial-ui-kit';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DetailsPanelProps } from '../../models/item-details-props';
import { CatalogDetailsTab } from '../../types/detail-tab';
import { DetailsConfirmationKind } from '../../types/details-confirmation';
import {
  CATALOG_PUBLISH_ALLOWS_REPLACE,
  defaultCredentialsManagementTitle,
  EMPTY_PUBLISH_FOLDERS,
  EMPTY_RULE_SOURCE_OPTIONS,
  getDetailsPanelCssVars,
} from '../../utils/details-panel';
import { getCatalogDetailsTabs } from '../../utils/details-tabs';
import { getCredentialsBannerState } from '../../utils/toolset-credentials';
import { StarToggleButton } from '../StarToggleButton/StarToggleButton';
import { CredentialsBanner } from './Credentials/CredentialsBanner/CredentialsBanner';
import { CredentialsManagementPanel } from './Credentials/CredentialsManagementPanel/CredentialsManagementPanel';
import styles from './DetailsPanel.module.scss';
import { DetailsPublishContent } from './DetailsPublishContent';
import { DetailsTabs } from './DetailsTabs';
import { Header } from './Header/Header';
import { useDetailsConfirmation } from './hooks/useDetailsConfirmation';
import { useDetailsContentFile } from './hooks/useDetailsContentFile';
import { useDetailsPublish } from './hooks/useDetailsPublish';

/** Right-side slide-in panel displaying full details for a catalog item. */
export const DetailsPanel: FC<DetailsPanelProps> = ({
  item,
  isOpen,
  isStarred: initialIsStarred = false,
  isDetailsLoading = false,
  isReadonly = false,
  onClose,
  onToggleFavorite,
  isFavoriteVisible,
  onUseInChat,
  isPrimaryActionVisible,
  onShare,
  isPublishVisible,
  isPublishPrimary,
  getPublishHistory,
  publishFolderItems = EMPTY_PUBLISH_FOLDERS,
  publishExpandedPaths,
  onPublishExpandedPathsChange,
  publishLoadingPaths,
  hasPublishWriteAccess,
  publishDefaultAuthor,
  onPublish,
  onPublishSuccess,
  onPublishError,
  onCreatePublishFolder,
  publishLabels,
  ruleSourceOptions = EMPTY_RULE_SOURCE_OPTIONS,
  onFetchExistingRules,
  shareOverlay,
  isShareVisible,
  isSharePrimary,
  onEdit,
  onDownload,
  isDownloadVisible,
  isDownloadPrimary,
  onLoadContentFile,
  onLoadContentFilePreview,
  renderContentFilePreview,
  renderContentFileTree,
  renderCredentials,
  onDelete,
  onUnshare,
  isUnshareVisible,
  onRevokeShare,
  onFetchRecipientsCount,
  isRevokeShareVisible,
  onUnpublish,
  isUnpublishVisible,
  onLogin,
  onLogout,
  texts,
  styles: detailsStyles,
  limitsFooterNote,
}) => {
  const {
    subViewTitleClassName = 'dial-body-semi-text',
    confirmMessageClassName = 'dial-small-text',
  } = detailsStyles?.typography ?? {};

  const detailsColors = detailsStyles?.colors;
  /* Set on both the backdrop and the panel — they are siblings, not nested. */
  const cssVars = getDetailsPanelCssVars(detailsColors);

  const [isStarred, setIsStarred] = useState(initialIsStarred);
  const [activeTab, setActiveTab] = useState<string>('');

  const contentFile = useDetailsContentFile({
    item,
    onLoadContentFile,
    onLoadContentFilePreview,
    renderContentFilePreview,
    texts,
  });

  const {
    isPublishOpen,
    isPublishHistoryResolved,
    requestPublishHistory,
    publishFlow,
    isPublishCredentialsEligible,
    publishDerived,
    publishedFolders,
    hasPublishedFolders,
    formatFolderLabel,
    handleOpenPublish,
    handleClosePublish,
    publishFolderView,
    isPublishFolderView,
    handleSubmitPublish,
  } = useDetailsPublish({
    item,
    isReadonly,
    getPublishHistory,
    publishFolderItems,
    hasPublishWriteAccess,
    publishDefaultAuthor,
    onPublish,
    onPublishSuccess,
    onPublishError,
    onCreatePublishFolder,
    onFetchExistingRules,
    onUnpublish,
    isUnpublishVisible,
    publishLabels,
  });

  const {
    confirmation,
    isConfirming,
    selectedUnpublishFolder,
    setSelectedUnpublishFolder,
    handleRequestDelete,
    handleRequestLogout,
    handleRequestUnshare,
    handleRequestRevokeShare,
    handleRequestUnpublish,
    handleRequestDeleteApiKey,
    handleCancelConfirmation,
    handleConfirm,
    confirmationContent,
    isConfirmDisabled,
  } = useDetailsConfirmation({
    item,
    isOpen,
    onClose,
    onDelete,
    onUnshare,
    onRevokeShare,
    onLogout,
    onUnpublish,
    texts,
    publishedFolders,
    formatFolderLabel,
  });

  const [isCredentialsManagementOpen, setIsCredentialsManagementOpen] =
    useState(false);

  useEffect(() => {
    setIsStarred(initialIsStarred);
  }, [item.id, initialIsStarred]);

  useEffect(() => {
    /*
     * Cleared rather than set to a named tab: `About` is not in every item's
     * tab set (a prompt has none), so naming it here would select a tab that
     * does not exist. The reconciliation effect below picks whichever tab is
     * actually first for this item.
     */
    setActiveTab('');
    setIsCredentialsManagementOpen(false);
  }, [item.id]);

  const handleOpenCredentialsManagement = useCallback(
    () => setIsCredentialsManagementOpen(true),
    [],
  );
  const handleCloseCredentialsManagement = useCallback(
    () => setIsCredentialsManagementOpen(false),
    [],
  );

  const handleToggleFavorite = useCallback(() => {
    const next = !isStarred;
    setIsStarred(next);
    onToggleFavorite?.(item.id, next);
  }, [isStarred, item.id, onToggleFavorite]);

  const tabs = useMemo(() => {
    const labels: Record<CatalogDetailsTab, string> = {
      [CatalogDetailsTab.About]: texts?.tabAboutLabel ?? 'About',
      [CatalogDetailsTab.Content]: texts?.tabContentLabel ?? 'Details',
      [CatalogDetailsTab.Overview]: texts?.tabOverviewLabel ?? 'Overview',
      [CatalogDetailsTab.Pricing]: texts?.tabPricingLabel ?? 'Pricing',
      [CatalogDetailsTab.Limits]: texts?.tabLimitsLabel ?? 'Limits',
      [CatalogDetailsTab.Api]: texts?.tabConnectLabel ?? 'Connect',
      [CatalogDetailsTab.Tools]: texts?.tabToolsLabel ?? 'Tools',
    };
    // Which tabs show, and in what order, is the shared rule hosts embedding
    // the tab components also use (`getCatalogDetailsTabs`).
    return getCatalogDetailsTabs(item).map((id) => ({ id, label: labels[id] }));
  }, [item, texts]);

  /*
   * Every item opens on its first tab: a tab the previous item happened to
   * share must not carry over. Within one item the selection is kept, unless
   * a newly-fetched details payload dropped the active tab from the list.
   */
  const shownItemId = useRef<string | null>(null);
  useEffect(() => {
    const isNewItem = shownItemId.current !== item.id;
    shownItemId.current = item.id;
    if (isNewItem || !tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? '');
    }
  }, [item.id, tabs, activeTab]);

  const panelAriaLabel = texts?.ariaLabel ?? 'Item details';
  const closeAriaLabel = texts?.closeAriaLabel ?? 'Close';
  const starAriaLabel = isStarred
    ? (texts?.removeFromFavoritesAriaLabel ?? 'Remove from favorites')
    : (texts?.addToFavoritesAriaLabel ?? 'Add to favorites');
  const publishTitle = texts?.publishTitle ?? 'Publish';
  const backToDetailsAriaLabel = texts?.backToDetailsAriaLabel ?? 'Back';
  const cancelLabel = texts?.cancelLabel ?? 'Cancel';

  const isConfirmationOpen = confirmationContent != null;

  const isSubViewOpen =
    isConfirmationOpen || isPublishOpen || isCredentialsManagementOpen;

  const credentialsManagementTitle =
    item.credentials != null
      ? (
          texts?.credentialsManagementTitle ?? defaultCredentialsManagementTitle
        )(item.credentials.authenticationType)
      : '';

  /* A confirmation, the publish flow, and credentials management never share the header; null means the details header. */
  const subViewHeader = (() => {
    if (isConfirmationOpen) {
      return {
        title: confirmationContent.title,
        isBackDisabled: isConfirming,
        onBack: handleCancelConfirmation,
      };
    }
    if (isPublishOpen) {
      return {
        title: isPublishFolderView
          ? (texts?.publishChangeFolderTitle ?? 'Change folder')
          : publishTitle,
        isBackDisabled: publishFlow.isSubmitting,
        onBack: isPublishFolderView
          ? publishFolderView.backToMain
          : handleClosePublish,
      };
    }
    if (isCredentialsManagementOpen) {
      return {
        title: credentialsManagementTitle,
        isBackDisabled: false,
        onBack: handleCloseCredentialsManagement,
      };
    }
    return null;
  })();

  /* While a sub-view is open the dialog is named after it, not the details. */
  const dialogAriaLabel = subViewHeader?.title ?? panelAriaLabel;

  /*
   * The kit drawer owns the backdrop, the slide, focus and scroll lock, and
   * Escape/backdrop dismissal. Its body is turned into a column so the
   * content below scrolls on its own while the footers stay pinned under it.
   */
  return (
    <SideDrawer
      open={isOpen}
      onClose={onClose}
      header={subViewHeader?.title}
      ariaLabel={dialogAriaLabel}
      onBack={subViewHeader?.onBack}
      backAriaLabel={backToDetailsAriaLabel}
      backDisabled={subViewHeader?.isBackDisabled}
      hideClose={subViewHeader != null}
      closeAriaLabel={closeAriaLabel}
      headerActions={
        subViewHeader == null &&
        !isReadonly &&
        isFavoriteVisible?.(item) !== false ? (
          <StarToggleButton
            isStarred={isStarred}
            ariaLabel={starAriaLabel}
            onClick={handleToggleFavorite}
          />
        ) : undefined
      }
      style={cssVars}
      overlayStyle={cssVars}
      className={mergeClasses(
        styles.panel,
        'tablet:w-[540px]! tablet:max-w-[calc(100%-32px)]!',
      )}
      overlayClassName={styles.backdrop}
      headerClassName={styles.divider}
      titleClassName={mergeClasses(subViewTitleClassName, styles.publishTitle)}
      bodyClassName="flex flex-col overflow-hidden"
    >
      <div
        className={mergeClasses(
          'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto',
          styles.content,
        )}
      >
        {isConfirmationOpen && (
          <ConfirmationView
            item={item}
            message={confirmationContent.message}
            consequences={confirmationContent.consequences}
            variant={
              confirmationContent.cardVariant ?? confirmationContent.variant
            }
            messageClassName={confirmMessageClassName}
            styles={{
              colors: {
                messageText: detailsColors?.confirmMessageText,
                consequenceText: detailsColors?.confirmConsequenceText,
                cardBackground: detailsColors?.infoCardBackground,
                cardDangerBackground: detailsColors?.infoCardDangerBackground,
              },
            }}
          >
            {confirmation === DetailsConfirmationKind.Unpublish &&
              publishedFolders.length > 1 && (
                <RadioGroup
                  ariaLabel={
                    texts?.unpublishFolderGroupAriaLabel ?? 'Published folders'
                  }
                  value={selectedUnpublishFolder ?? undefined}
                  onChange={setSelectedUnpublishFolder}
                  /* Locked in flight so the choice cannot drift away from the
                   * folder path the request already captured. */
                  disabled={isConfirming}
                  items={publishedFolders.map((folder) => ({
                    value: folder.key,
                    label: formatFolderLabel(folder.key),
                  }))}
                  radioClassName={confirmMessageClassName}
                />
              )}
          </ConfirmationView>
        )}

        {!isConfirmationOpen &&
          !isPublishOpen &&
          isCredentialsManagementOpen && (
            <CredentialsManagementPanel
              item={item}
              onLogin={onLogin}
              onRequestLogout={handleRequestLogout}
              onRequestDeleteApiKey={handleRequestDeleteApiKey}
              texts={texts}
              detailsStyles={detailsStyles}
            />
          )}

        {!isConfirmationOpen && isPublishOpen && (
          <DetailsPublishContent
            item={item}
            publishFlow={publishFlow}
            publishFolderView={publishFolderView}
            isPublishCredentialsEligible={isPublishCredentialsEligible}
            publishExpandedPaths={publishExpandedPaths}
            onPublishExpandedPathsChange={onPublishExpandedPathsChange}
            publishLoadingPaths={publishLoadingPaths}
            ruleSourceOptions={ruleSourceOptions}
            publishLabels={publishLabels}
          />
        )}

        {!isSubViewOpen && (
          <>
            <Header
              item={item}
              onUseInChat={onUseInChat}
              isPrimaryActionVisible={isPrimaryActionVisible}
              onShare={onShare}
              shareOverlay={shareOverlay}
              isShareVisible={isShareVisible}
              isSharePrimary={isSharePrimary}
              isPublishVisible={isPublishVisible}
              isPublishPrimary={isPublishPrimary}
              onOpenPublish={handleOpenPublish}
              isUnpublishVisible={isUnpublishVisible}
              hasPublishedFolders={hasPublishedFolders}
              isPublishHistoryResolved={
                getPublishHistory == null || isPublishHistoryResolved
              }
              onRequestPublishHistory={requestPublishHistory}
              onOpenUnpublish={onUnpublish ? handleRequestUnpublish : undefined}
              onEdit={onEdit}
              onDownload={onDownload}
              isDownloadVisible={isDownloadVisible}
              isDownloadPrimary={isDownloadPrimary}
              onDelete={onDelete ? handleRequestDelete : undefined}
              onUnshare={onUnshare ? handleRequestUnshare : undefined}
              isUnshareVisible={isUnshareVisible}
              onRevokeShare={
                onRevokeShare ? handleRequestRevokeShare : undefined
              }
              onFetchRecipientsCount={onFetchRecipientsCount}
              isRevokeShareVisible={isRevokeShareVisible}
              onLogin={onLogin}
              onLogout={onLogout}
              onOpenCredentialsManagement={handleOpenCredentialsManagement}
              onRequestLogout={handleRequestLogout}
              texts={texts}
              detailsStyles={detailsStyles}
              isReadonly={isReadonly}
            />

            {item.credentials != null &&
              (() => {
                const bannerState = getCredentialsBannerState(item.credentials);
                return (
                  bannerState != null && (
                    <div className="px-6">
                      <CredentialsBanner
                        state={bannerState}
                        authenticationType={item.credentials.authenticationType}
                        texts={texts}
                      />
                    </div>
                  )
                );
              })()}

            {!isReadonly && isOpen && renderCredentials?.(item)}

            <DetailsTabs
              item={item}
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isDetailsLoading={isDetailsLoading}
              contentFile={contentFile}
              renderContentFileTree={renderContentFileTree}
              texts={texts}
              detailsStyles={detailsStyles}
              limitsFooterNote={limitsFooterNote}
            />
          </>
        )}
      </div>

      {isConfirmationOpen && (
        <ConfirmationFooter
          confirmLabel={confirmationContent.confirmLabel}
          cancelLabel={cancelLabel}
          variant={confirmationContent.variant}
          isLoading={isConfirming}
          isConfirmDisabled={isConfirmDisabled}
          loadingStatusLabel={confirmationContent.loadingStatusLabel}
          styles={{ colors: { border: detailsColors?.confirmFooterBorder } }}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirmation}
        />
      )}

      {!isConfirmationOpen && isPublishOpen && (
        <PublishFooter
          version={item.version}
          hasExistingPublicationInFolder={
            publishFlow.hasExistingPublicationInFolder
          }
          allowReplace={CATALOG_PUBLISH_ALLOWS_REPLACE}
          isSubmitDisabled={publishDerived.isSubmitDisabled}
          isSubmitLoading={publishDerived.isSubmitLoading}
          onCancel={
            isPublishFolderView
              ? publishFolderView.backToMain
              : handleClosePublish
          }
          onSubmit={handleSubmitPublish}
          view={publishFolderView.view}
          onSelectFolder={publishFolderView.selectFolder}
          isSelectFolderDisabled={publishFolderView.pendingFolderPath == null}
          labels={publishLabels}
        />
      )}
    </SideDrawer>
  );
};

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
  CloseButton,
  ElementSize,
  Skeleton,
  DialTag,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronLeft } from '@tabler/icons-react';
import {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CatalogItem } from '../../models/catalog-item';
import type { DetailsPanelProps } from '../../models/item-details-props';
import { CatalogDetailsTab } from '../../types/detail-tab';
import {
  DetailsConfirmationKind,
  DetailsConfirmationVariant,
} from '../../types/details-confirmation';
import { CatalogEntityType } from '../../types/entity-type';
import { getSignedInLevel } from '../../utils/toolset-credentials';
import { EntityHeader } from '../EntityHeader/EntityHeader';
import { StarToggleButton } from '../StarToggleButton/StarToggleButton';
import { ApiDetails } from './ApiDetails';
import { ConfirmationFooter } from './ConfirmationView/ConfirmationFooter';
import { ConfirmationView } from './ConfirmationView/ConfirmationView';
import { CredentialsSection } from './Credentials/CredentialsSection';
import styles from './DetailsPanel.module.scss';
import { Header } from './Header/Header';
import { AboutTab } from './TabsContent/About';
import { ContentTab } from './TabsContent/Content';
import { LimitsTab } from './TabsContent/Limits';
import { Overview } from './TabsContent/Overview';
import { Pricing } from './TabsContent/Pricing';
import { Tools } from './TabsContent/Tools/Tools';

const NO_OP_PUBLISH = async () => undefined;
const EMPTY_PUBLISH_FOLDERS: PublishFolderNode[] = [];
const EMPTY_RULE_SOURCE_OPTIONS: string[] = [];

const DEFAULT_DELETE_CONSEQUENCES = [
  'All shared configurations will be lost',
  'Users who rely on it will lose access',
  'Cannot be undone',
];

const DEFAULT_UNSHARE_CONSEQUENCES = [
  'You will lose access to this item',
  'Other people keep their access',
  'You will need a new invitation to get it back',
];

/** Everything the panel needs to render the confirmation step for one {@link DetailsConfirmationKind}. */
interface ConfirmationContent {
  /** Sub-view title, shown next to the back button and used as the dialog's accessible name. */
  title: string;
  /** Confirmation body copy. */
  message: ReactNode;
  /** Consequences listed as bullets under the message. */
  consequences?: string[];
  /** Label of the confirming action button. */
  confirmLabel: string;
  /** Status text announced to assistive tech while the action is in flight. */
  loadingStatusLabel: string;
  /** Palette the step is rendered with. */
  variant: DetailsConfirmationVariant;
}

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
  onUnshare,
  isUnshareVisible,
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
    confirmMessageClassName = 'dial-small-text',
  } = detailsStyles?.typography ?? {};

  const detailsColors = detailsStyles?.colors;
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
    '--cat-details-content-text': detailsColors?.contentText,
    '--cat-details-content-bg': detailsColors?.contentBackground,
    '--cat-api-heading-text': detailsColors?.apiHeadingText,
    '--cat-tools-divider': detailsColors?.toolsDivider,
    '--cat-tools-description-text': detailsColors?.toolsDescriptionText,
    '--cat-grid-border': detailsColors?.gridBorder,
    '--cat-grid-header-text': detailsColors?.gridHeaderText,
    '--cat-grid-header-bg': detailsColors?.gridHeaderBackground,
    '--cat-grid-cell-text': detailsColors?.gridCellText,
    '--cat-grid-cell-divider': detailsColors?.gridCellDivider,
    '--cat-grid-row-even-bg': detailsColors?.gridRowEvenBackground,
    '--cat-info-card-bg': detailsColors?.infoCardBackground,
    '--cat-info-card-danger-bg': detailsColors?.infoCardDangerBackground,
    '--cat-confirm-message-text': detailsColors?.confirmMessageText,
    '--cat-confirm-consequence-text': detailsColors?.confirmConsequenceText,
    '--cat-confirm-footer-border': detailsColors?.confirmFooterBorder,
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
  const [confirmation, setConfirmation] =
    useState<DetailsConfirmationKind | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

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
    setConfirmation(null);
    setIsConfirming(false);
    // Reset publish-flow-local state only when the displayed item changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const handleToggleCredentials = useCallback(() => {
    setIsCredentialsOpen((prev) => !prev);
  }, []);

  const handleRequestDelete = useCallback(() => {
    setConfirmation(DetailsConfirmationKind.Delete);
  }, []);

  const handleRequestLogout = useCallback(() => {
    setConfirmation(DetailsConfirmationKind.Logout);
  }, []);

  const handleRequestUnshare = useCallback(() => {
    setConfirmation(DetailsConfirmationKind.Unshare);
  }, []);

  const handleCancelConfirmation = useCallback(() => {
    if (isConfirming) return;
    setConfirmation(null);
  }, [isConfirming]);

  const handleConfirm = useCallback(async () => {
    if (isConfirming || confirmation == null) return;
    setIsConfirming(true);
    try {
      if (confirmation === DetailsConfirmationKind.Logout) {
        if (item.credentials != null) {
          await onLogout?.(item, { level: getSignedInLevel(item.credentials) });
        }
        /* Logging out leaves the item in the catalog, so the panel stays open. */
        setConfirmation(null);
        return;
      }

      if (confirmation === DetailsConfirmationKind.Delete) {
        await onDelete?.(item);
      } else {
        await onUnshare?.(item);
      }
      /* The item is gone from the caller's catalog — close the whole panel. */
      setConfirmation(null);
      onClose();
    } catch {
      /*
       * Failure feedback (e.g. a notification) is the caller's
       * responsibility; the item stays visible and the panel stays open.
       */
      setConfirmation(null);
    } finally {
      setIsConfirming(false);
    }
  }, [
    isConfirming,
    confirmation,
    item,
    onDelete,
    onUnshare,
    onLogout,
    onClose,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      /* Escape backs out of an open confirmation before it closes the panel. */
      if (confirmation != null) {
        handleCancelConfirmation();
        return;
      }
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, confirmation, handleCancelConfirmation]);

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
    const result: { id: string; label: string }[] = [];
    /*
     * A prompt's description and metadata live in its Overview tab, so an
     * About tab would only repeat them: prompts show Content + Overview only.
     */
    if (item.type !== CatalogEntityType.Prompt) {
      result.push({
        id: CatalogDetailsTab.About,
        label: texts?.tabAboutLabel ?? 'About',
      });
    }
    if (item.details?.promptContent != null) {
      result.push({
        id: CatalogDetailsTab.Content,
        label: texts?.tabContentLabel ?? 'Content',
      });
    }
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
  const cancelLabel = texts?.cancelLabel ?? 'Cancel';

  const confirmationContent = useMemo<ConfirmationContent | null>(() => {
    switch (confirmation) {
      case DetailsConfirmationKind.Delete: {
        const deleteLabel = texts?.deleteActionLabel ?? 'Delete';
        return {
          title: texts?.deleteConfirmTitle ?? deleteLabel,
          message: texts?.deleteConfirmMessage?.(item.name) ?? (
            <>
              Are you sure you want to delete <strong>{item.name}</strong>? This
              action is permanent and cannot be undone.
            </>
          ),
          consequences:
            texts?.deleteConfirmConsequences ?? DEFAULT_DELETE_CONSEQUENCES,
          confirmLabel: deleteLabel,
          loadingStatusLabel: texts?.deletingStatusLabel ?? 'Deleting',
          variant: DetailsConfirmationVariant.Danger,
        };
      }
      case DetailsConfirmationKind.Unshare: {
        const unshareLabel = texts?.unshareLabel ?? 'Remove from My List';
        return {
          title: texts?.unshareConfirmTitle ?? unshareLabel,
          message: texts?.unshareConfirmMessage?.(item.name) ?? (
            <>
              Remove <strong>{item.name}</strong> from your list? You&apos;ll
              need a new invitation to access it again.
            </>
          ),
          consequences:
            texts?.unshareConfirmConsequences ?? DEFAULT_UNSHARE_CONSEQUENCES,
          confirmLabel: unshareLabel,
          loadingStatusLabel: texts?.unsharingStatusLabel ?? 'Removing',
          /* Removal only revokes the caller's own access and is recoverable
           * with a new invitation, so it is not framed as destructive. */
          variant: DetailsConfirmationVariant.Info,
        };
      }
      case DetailsConfirmationKind.Logout: {
        const logoutLabel = texts?.logoutActionLabel ?? 'Log out';
        return {
          title: logoutLabel,
          message:
            texts?.logoutConfirmMessage ?? 'Are you sure you want to log out?',
          consequences: undefined,
          confirmLabel: logoutLabel,
          loadingStatusLabel: texts?.loggingOutStatusLabel ?? 'Logging out',
          variant: DetailsConfirmationVariant.Info,
        };
      }
      default:
        return null;
    }
  }, [confirmation, item.name, texts]);

  const isConfirmationOpen = confirmationContent != null;
  const isSubViewOpen = isConfirmationOpen || isPublishOpen;

  /* A confirmation and the publish flow never share the header; null means the details header. */
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
        title: publishTitle,
        isBackDisabled: publishFlow.isSubmitting,
        onBack: handleClosePublish,
      };
    }
    return null;
  })();

  /* While a sub-view is open the dialog is named after it, not the details. */
  const dialogAriaLabel = subViewHeader?.title ?? panelAriaLabel;

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
        aria-label={dialogAriaLabel}
        style={cssVars}
        className={mergeClasses(
          'fixed inset-y-0 end-0 z-50 flex w-full flex-col overflow-hidden',
          'desktop:rounded-ts-xl desktop:rounded-bs-xl desktop:w-[540px] desktop:border-s',
          'transition-transform duration-300',
          styles.panel,
          isOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-center gap-2 px-6 py-3">
          {subViewHeader != null && (
            <>
              <GhostIconButton
                icon={<IconChevronLeft className="rtl:scale-x-[-1]" />}
                aria-label={backToDetailsAriaLabel}
                disabled={subViewHeader.isBackDisabled}
                onClick={subViewHeader.onBack}
              />
              <span
                className={mergeClasses(
                  'dial-body-semi-text flex-1',
                  styles.publishTitle,
                )}
              >
                {subViewHeader.title}
              </span>
            </>
          )}
          {subViewHeader == null && (
            <>
              <div className="flex-1" />
              <StarToggleButton
                isStarred={isStarred}
                ariaLabel={starAriaLabel}
                onClick={handleToggleFavorite}
              />
              <CloseButton
                onClose={onClose}
                size={ElementSize.Standard}
                ariaLabel={closeAriaLabel}
              />
            </>
          )}
        </div>

        <div className={mergeClasses('shrink-0', styles.divider)} />

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
              variant={confirmationContent.variant}
              messageClassName={confirmMessageClassName}
            />
          )}

          {!isConfirmationOpen && isPublishOpen && (
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
                isPublishVisible={isPublishVisible}
                onOpenPublish={handleOpenPublish}
                onEdit={onEdit}
                onDelete={onDelete ? handleRequestDelete : undefined}
                onUnshare={onUnshare ? handleRequestUnshare : undefined}
                isUnshareVisible={isUnshareVisible}
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

              <div className="flex items-center px-6">
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
                  activeTab !== CatalogDetailsTab.Overview && 'mt-4 px-6',
                )}
              >
                {activeTab === CatalogDetailsTab.About && (
                  <AboutTab
                    content={item.description}
                    topics={item.topics}
                    detailsStyles={detailsStyles}
                  />
                )}
                {activeTab === CatalogDetailsTab.Content &&
                  item.details?.promptContent != null && (
                    <ContentTab
                      content={item.details.promptContent.content}
                      copyAriaLabel={texts?.copyContentAriaLabel}
                      copiedStatusLabel={texts?.contentCopiedStatusLabel}
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

        {isConfirmationOpen && (
          <ConfirmationFooter
            confirmLabel={confirmationContent.confirmLabel}
            cancelLabel={cancelLabel}
            variant={confirmationContent.variant}
            isLoading={isConfirming}
            loadingStatusLabel={confirmationContent.loadingStatusLabel}
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

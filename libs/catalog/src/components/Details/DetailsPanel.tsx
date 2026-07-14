import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { TabRow } from '@epam/ai-dial-kit';
import {
  DialCloseButton,
  DialConfirmationPopup,
  DialSkeleton,
} from '@epam/ai-dial-ui-kit';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import type { DetailsPanelProps } from '../../models/item-details-props';
import { CatalogDetailsTab } from '../../types/detail-tab';
import { getSignedInLevel } from '../../utils/toolset-credentials';
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
  shareOverlay,
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
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [isDirectLogoutConfirmOpen, setIsDirectLogoutConfirmOpen] =
    useState(false);

  useEffect(() => {
    setIsStarred(initialIsStarred);
  }, [item.id, initialIsStarred]);

  useEffect(() => {
    setIsCredentialsOpen(false);
    setIsDirectLogoutConfirmOpen(false);
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
        <div className="flex shrink-0 items-center justify-end gap-1.5 px-[22px] py-3">
          <StarToggleButton
            isStarred={isStarred}
            ariaLabel={starAriaLabel}
            onClick={handleToggleFavorite}
          />
          <DialCloseButton onClose={onClose} ariaLabel={closeAriaLabel} />
        </div>

        <div className={mergeClasses('shrink-0', styles.divider)} />

        <div
          className={mergeClasses(
            'min-h-0 flex-1 overflow-y-auto',
            styles.content,
          )}
        >
          <Header
            item={item}
            onUseInChat={onUseInChat}
            isPrimaryActionVisible={isPrimaryActionVisible}
            onShare={onShare}
            shareOverlay={shareOverlay}
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
              texts?.logoutConfirmMessage ?? 'Are you sure you want to log out?'
            }
            confirmLabel={texts?.logoutActionLabel ?? 'Log out'}
            onConfirm={handleConfirmDirectLogout}
            onCancel={handleCancelDirectLogout}
            onClose={handleCancelDirectLogout}
          />

          <div className={styles.divider} />

          <Summary item={item} texts={texts} detailsStyles={detailsStyles} />

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
                aria-label={texts?.detailsLoadingAriaLabel ?? 'Loading details'}
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
        </div>
      </div>
    </>
  );
};

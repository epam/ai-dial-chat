import { DeploymentIcon, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  DIAL_ICON_SIZE,
  DialCloseButton,
  DialNeutralButton,
  DialPrimaryButton,
  DialTag,
  DialTabs,
} from '@epam/ai-dial-ui-kit';
import {
  IconChevronDown,
  IconPlayerPlayFilled,
  IconShare,
} from '@tabler/icons-react';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemDetailsProps } from '../../models/item-details-props';
import { CatalogDetailsTab } from '../../types/detail-tab';
import type { AboutRun } from '../../utils/parse-about-content';
import { parseAboutContent } from '../../utils/parse-about-content';
import { EntityBadge } from '../EntityBadge/EntityBadge';
import { FolderPath } from '../FolderPath/FolderPath';
import { StarToggleButton } from '../StarToggleButton/StarToggleButton';
import { TopicTag } from '../TopicTag/TopicTag';
import { CatalogApiDetails } from './CatalogApiDetails';
import styles from './CatalogItemDetails.module.scss';
import { CatalogOverview } from './CatalogOverview';
import { CatalogPricing } from './CatalogPricing';
import { CatalogSummary } from './CatalogSummary';
import { CatalogTools } from './CatalogTools';

interface AboutRunViewProps {
  run: AboutRun;
  contentClassName: string;
}

const AboutRunView: FC<AboutRunViewProps> = ({ run, contentClassName }) => {
  if (run.kind === 'bullets') {
    return (
      <ul className="m-0 flex list-none flex-col gap-1 ps-0">
        {run.items.map((text, i) => (
          <li key={i} className={mergeClasses('flex gap-2', contentClassName)}>
            <span aria-hidden="true">•</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className={mergeClasses('m-0', contentClassName)}>{run.text}</p>;
};

/** Right-side slide-in panel displaying full details for a catalog item. */
export const CatalogItemDetails: FC<ItemDetailsProps> = ({
  item,
  isOpen,
  isStarred: initialIsStarred = false,
  aboutContent,
  isAboutLoading = false,
  onClose,
  onToggleFavorite,
  onUseInChat,
  onShare,
  texts,
  styles: detailsStyles,
}) => {
  const {
    nameClassName = 'dial-display-2-text',
    versionClassName = 'dial-tiny-text',
    introCaptionClassName = 'dial-caption-text',
    introTextClassName = 'dial-small-text',
    contentHeadingClassName = 'dial-small-semi-text',
    contentClassName = 'dial-small-text',
    overviewSectionClassName = 'dial-caption-text',
    overviewLabelClassName = 'dial-small-semi-text',
    overviewValueClassName = 'dial-small-text',
    overviewValueTrueClassName = 'dial-small-text',
  } = detailsStyles?.typography ?? {};

  const [isStarred, setIsStarred] = useState(initialIsStarred);
  const [activeTab, setActiveTab] = useState<string>(CatalogDetailsTab.About);

  useEffect(() => {
    setIsStarred(initialIsStarred);
  }, [item.id, initialIsStarred]);

  useEffect(() => {
    setActiveTab(CatalogDetailsTab.About);
  }, [item.id]);

  const handleToggleFavorite = useCallback(() => {
    const next = !isStarred;
    setIsStarred(next);
    onToggleFavorite?.(item.id, next);
  }, [isStarred, item.id, onToggleFavorite]);

  const handleUseInChat = useCallback(() => {
    onUseInChat?.(item);
  }, [item, onUseInChat]);

  const handleShare = useCallback(() => {
    onShare?.(item);
  }, [item, onShare]);

  const tabs = useMemo(() => {
    const result = [
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

  // Reset to About when the active tab is no longer in the available list.
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab)) {
      setActiveTab(CatalogDetailsTab.About);
    }
  }, [tabs, activeTab]);

  const parsedAboutBlocks = useMemo(
    () => parseAboutContent(aboutContent ?? item.description),
    [aboutContent, item.description],
  );

  const overviewYesLabel = texts?.overviewYesLabel ?? 'Yes';
  const overviewNoLabel = texts?.overviewNoLabel ?? 'No';

  const panelAriaLabel = texts?.ariaLabel ?? 'Item details';
  const closeAriaLabel = texts?.closeAriaLabel ?? 'Close';
  const starAriaLabel = isStarred
    ? (texts?.removeFromFavoritesAriaLabel ?? 'Remove from favorites')
    : (texts?.addToFavoritesAriaLabel ?? 'Add to favorites');

  return (
    <>
      {/* Backdrop */}
      <div
        className={mergeClasses(
          'fixed inset-0 z-40 transition-opacity duration-300',
          styles.backdrop,
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={panelAriaLabel}
        className={mergeClasses(
          'fixed inset-y-0 end-0 z-50 flex w-[540px] flex-col overflow-hidden',
          'rounded-ts-xl rounded-bs-xl border-s border-secondary',
          'transition-transform duration-300',
          styles.panel,
          isOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
        )}
      >
        {/* Header: favorite + close */}
        <div className="flex shrink-0 items-center justify-end gap-1.5 px-[22px] py-3">
          <StarToggleButton
            isStarred={isStarred}
            ariaLabel={starAriaLabel}
            onClick={handleToggleFavorite}
          />
          <DialCloseButton onClose={onClose} ariaLabel={closeAriaLabel} />
        </div>

        <div className="shrink-0 border-b border-tertiary" />

        {/* Identity: logo, type, name, folder path, action buttons */}
        <div className="flex shrink-0 gap-3.5 px-[22px] py-4">
          <DeploymentIcon src={item.iconUrl} size={52} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-1">
              <EntityBadge type={item.type} />
              {item.isFeatured && (
                <DialTag
                  label={texts?.featuredLabel ?? 'Featured'}
                  className={mergeClasses(
                    'ms-auto px-[6px]',
                    styles.featuredTag,
                  )}
                />
              )}
            </div>
            <div className="flex items-end gap-1">
              <span className={nameClassName}>{item.name}</span>
              <span className={mergeClasses(versionClassName, styles.version)}>
                {item.version}
              </span>
            </div>
            <FolderPath segments={item.folder} />
            <div className="mt-3 flex flex-wrap gap-2">
              {(texts?.hasPrimaryAction ?? true) && (
                <DialPrimaryButton
                  label={
                    texts?.primaryActionLabel ??
                    texts?.useInChatLabel ??
                    'Use in chat'
                  }
                  iconBefore={<IconPlayerPlayFilled size={DIAL_ICON_SIZE.MD} />}
                  onClick={handleUseInChat}
                />
              )}
              <DialNeutralButton
                appearance={ButtonAppearance.Outlined}
                label={texts?.shareLabel ?? 'Share'}
                iconBefore={<IconShare size={DIAL_ICON_SIZE.MD} />}
                iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.MD} />}
                onClick={handleShare}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-b border-tertiary" />

        {/* Summary: intro + topics + entity summary block */}
        <div className="flex shrink-0 flex-col gap-5 px-[22px] py-4">
          <div className="flex flex-col gap-2.5">
            <span
              className={mergeClasses(
                introCaptionClassName,
                styles.introCaption,
              )}
            >
              {texts?.introLabel ?? 'Intro'}
            </span>
            <p className={mergeClasses('m-0', introTextClassName)}>
              {item.description}
            </p>
          </div>
          {item.topics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.topics.map((p) => (
                <TopicTag key={p} label={p} />
              ))}
            </div>
          )}
          {item.summary != null && (
            <CatalogSummary
              summary={item.summary}
              dailyLimitLabel={texts?.dailyLimitLabel ?? 'Daily limit'}
            />
          )}
        </div>

        <div className="shrink-0 border-b border-tertiary" />

        {/* Tabs */}
        <div className="shrink-0 border-b border-secondary px-[22px]">
          <DialTabs tabs={tabs} activeTab={activeTab} onClick={setActiveTab} />
        </div>

        {/* Tab content — scrollable */}
        <div
          className={mergeClasses(
            'min-h-0 flex-1 overflow-y-auto',
            styles.content,
            activeTab === CatalogDetailsTab.Overview
              ? undefined
              : 'px-[22px] py-4',
          )}
        >
          {activeTab === CatalogDetailsTab.About &&
            (isAboutLoading && aboutContent == null ? (
              <div className="flex animate-pulse flex-col gap-3">
                <div
                  className={mergeClasses(
                    'h-3 rounded-sm',
                    styles.skeletonLine,
                  )}
                />
                <div
                  className={mergeClasses(
                    'h-3 w-4/5 rounded-sm',
                    styles.skeletonLine,
                  )}
                />
                <div
                  className={mergeClasses(
                    'h-3 rounded-sm',
                    styles.skeletonLine,
                  )}
                />
                <div
                  className={mergeClasses(
                    'h-3 w-3/4 rounded-sm',
                    styles.skeletonLine,
                  )}
                />
                <div className="h-2" />
                <div
                  className={mergeClasses(
                    'h-3 w-2/5 rounded-sm',
                    styles.skeletonLine,
                  )}
                />
                <div
                  className={mergeClasses(
                    'h-3 rounded-sm',
                    styles.skeletonLine,
                  )}
                />
                <div
                  className={mergeClasses(
                    'h-3 w-4/5 rounded-sm',
                    styles.skeletonLine,
                  )}
                />
                <div
                  className={mergeClasses(
                    'h-3 rounded-sm',
                    styles.skeletonLine,
                  )}
                />
                <div
                  className={mergeClasses(
                    'h-3 w-2/3 rounded-sm',
                    styles.skeletonLine,
                  )}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {parsedAboutBlocks.map((block, blockIdx) => (
                  <div key={blockIdx} className="flex flex-col gap-2">
                    {block.heading != null && (
                      <span className={contentHeadingClassName}>
                        {block.heading}
                      </span>
                    )}
                    {block.runs.map((run, runIdx) => (
                      <AboutRunView
                        key={runIdx}
                        run={run}
                        contentClassName={contentClassName}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          {activeTab === CatalogDetailsTab.Overview &&
            item.details?.overview != null && (
              <CatalogOverview
                sections={item.details.overview.sections}
                sectionClassName={overviewSectionClassName}
                labelClassName={overviewLabelClassName}
                valueClassName={overviewValueClassName}
                valueTrueClassName={overviewValueTrueClassName}
                yesLabel={overviewYesLabel}
                noLabel={overviewNoLabel}
              />
            )}
          {activeTab === CatalogDetailsTab.Pricing &&
            item.details?.pricing != null && (
              <CatalogPricing
                pricing={item.details.pricing}
                pricesSectionLabel={texts?.pricingPricesSectionLabel}
                limitsSectionLabel={texts?.pricingLimitsSectionLabel}
              />
            )}
          {activeTab === CatalogDetailsTab.Api && item.details?.api != null && (
            <CatalogApiDetails
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
          {activeTab === CatalogDetailsTab.Tools &&
            item.details?.tools != null && (
              <CatalogTools tools={item.details.tools} />
            )}
        </div>
      </div>
    </>
  );
};

import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialCloseButton,
  DialGhostButton,
  DialGhostIconButton,
  DialPrimaryButton,
  DialTabs,
} from '@epam/ai-dial-ui-kit';
import {
  IconChevronDown,
  IconPlayerPlayFilled,
  IconShare,
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemDetailsProps } from '../../models/item-details-props';
import { CatalogDetailsTab } from '../../types/detail-tab';
import type { AboutRun } from '../../utils/parse-about-content';
import { parseAboutContent } from '../../utils/parse-about-content';
import { EntityTypeBadge } from '../EntityTypeBadge/EntityTypeBadge';
import { FeaturedTag } from '../FeaturedTag/FeaturedTag';
import { FolderPath } from '../FolderPath/FolderPath';
import { PricingTag } from '../PricingTag/PricingTag';
import { ProviderLogo } from '../ProviderLogo/ProviderLogo';
import styles from './CatalogItemDetails.module.scss';
import { CatalogOverview } from './CatalogOverview';

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
    contentClassName = 'dial-tiny-text',
    overviewSectionClassName = 'dial-caption-text',
    overviewLabelClassName = 'dial-small-semi-text',
    overviewValueClassName = 'dial-small-text',
    overviewValueTrueClassName = 'dial-small-semi-text',
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

  const tabs = useMemo(
    () => [
      { id: CatalogDetailsTab.About, label: texts?.tabAboutLabel ?? 'About' },
      {
        id: CatalogDetailsTab.Overview,
        label: texts?.tabOverviewLabel ?? 'Overview',
      },
      {
        id: CatalogDetailsTab.Pricing,
        label: texts?.tabPricingLabel ?? 'Pricing',
      },
      { id: CatalogDetailsTab.Api, label: texts?.tabApiLabel ?? 'API' },
    ],
    [texts],
  );

  const parsedAboutBlocks = useMemo(
    () =>
      parseAboutContent(
        aboutContent ?? item.longDescription ?? item.description,
      ),
    [aboutContent, item.longDescription, item.description],
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
          <DialGhostIconButton
            icon={
              isStarred ? (
                <IconStarFilled
                  size={DIAL_ICON_SIZE.SM}
                  className={styles.starFilledIcon}
                />
              ) : (
                <IconStar size={DIAL_ICON_SIZE.SM} />
              )
            }
            aria-label={starAriaLabel}
            onClick={handleToggleFavorite}
          />
          <DialCloseButton onClose={onClose} ariaLabel={closeAriaLabel} />
        </div>

        <div className="shrink-0 border-b border-tertiary" />

        {/* Identity: logo, type, name, folder path, action buttons */}
        <div className="flex shrink-0 gap-3.5 px-[22px] py-4">
          <ProviderLogo
            color={item.logoColor}
            initial={item.logoInitial}
            size={52}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-1">
              <EntityTypeBadge type={item.type} />
              {item.isFeatured && (
                <div className="ms-auto">
                  <FeaturedTag />
                </div>
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
              <DialPrimaryButton
                label={texts?.useInChatLabel ?? 'Use in chat'}
                iconBefore={<IconPlayerPlayFilled size={DIAL_ICON_SIZE.MD} />}
                onClick={handleUseInChat}
              />
              <DialGhostButton
                label={texts?.shareLabel ?? 'Share'}
                iconBefore={<IconShare size={DIAL_ICON_SIZE.MD} />}
                iconAfter={<IconChevronDown size={DIAL_ICON_SIZE.MD} />}
                onClick={handleShare}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-b border-tertiary" />

        {/* Summary: intro + pricing */}
        <div className="flex shrink-0 flex-col gap-5 px-[22px] py-4">
          <div className="flex flex-col gap-2.5">
            <span className={introCaptionClassName}>
              {texts?.introLabel ?? 'Intro'}
            </span>
            <p className={mergeClasses('m-0', introTextClassName)}>
              {item.description}
            </p>
          </div>
          {item.pricing.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.pricing.map((p) => (
                <PricingTag key={p} label={p} />
              ))}
            </div>
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
            activeTab !== CatalogDetailsTab.Overview
              ? 'px-[22px] py-4'
              : undefined,
          )}
        >
          {activeTab === CatalogDetailsTab.About &&
            (isAboutLoading &&
            aboutContent == null &&
            item.longDescription == null ? (
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
            item.overview != null && (
              <CatalogOverview
                sections={item.overview.sections}
                sectionClassName={overviewSectionClassName}
                labelClassName={overviewLabelClassName}
                valueClassName={overviewValueClassName}
                valueTrueClassName={overviewValueTrueClassName}
                yesLabel={overviewYesLabel}
                noLabel={overviewNoLabel}
              />
            )}
        </div>
      </div>
    </>
  );
};

import React from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import Magnifier from '@/public/images/icons/search-alt.svg';

interface SuggestedMessageProps {
  shouldRender: boolean;
  className?: string;
}

export const SuggestedMessage: React.FC<SuggestedMessageProps> = ({
  shouldRender,
  className,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={classNames(
        'flex flex-col justify-center px-3 md:px-5 xl:px-16',
        className,
      )}
    >
      <div
        className="flex items-center gap-1"
        data-qa="no-workspace-results-found"
      >
        <Magnifier height={32} width={32} className="shrink-0 text-secondary" />
        <span className="text-sm sm:text-base">
          {t(MarketplaceI18nKeys.NoResultsInMyWorkspace)}
        </span>
      </div>
      <span
        className="mb-4 mt-5 text-xl font-semibold md:mt-6 lg:mt-8"
        data-qa="marketplace-suggestions-label"
      >
        {t(MarketplaceI18nKeys.SuggestedResults)}
      </span>
    </div>
  );
};

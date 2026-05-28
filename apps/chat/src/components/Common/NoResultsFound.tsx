import React from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';

import Magnifier from '@/public/images/icons/search-alt.svg';

interface NoResultsFoundProps {
  iconSize?: number;
  className?: string;
  additionalText?: string;
  children?: React.ReactNode | React.ReactNode[];
}

export const NoResultsFound = ({
  iconSize = 60,
  className = 'text-sm gap-3',
  additionalText = '',
  children,
}: NoResultsFoundProps) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <div
      className={classNames(
        'flex flex-col items-center justify-center',
        className,
      )}
      data-qa="no-data"
    >
      <Magnifier
        height={iconSize}
        width={iconSize}
        className="font-semibold text-secondary"
      />
      <span>
        {t(CommonI18nKeys.NoResultsFound)}
        {additionalText}
      </span>
      {children && <span>{children}</span>}
    </div>
  );
};

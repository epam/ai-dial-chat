import { IconCheck, IconLink } from '@tabler/icons-react';
import { MouseEvent, useCallback, useRef } from 'react';

import classNames from 'classnames';

import { useCopy } from '@/src/hooks/useCopy';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getApplicationLink, getToolsetLink } from '@/src/utils/marketplace';

import { DialAIEntityModel } from '@/src/types/models';
import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { Tooltip } from '@/src/components/Common/Tooltip';

interface MarketplaceCopyLinkProps {
  entity: DialAIEntityModel | ToolsetModel;
  size?: number;
  withText?: boolean;
  hasTooltip?: boolean;
  className?: string;
}

const TRIGGER_CLASS =
  'flex items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-accent-primary outline-none';

export function MarketplaceCopyLink({
  entity,
  size = 20,
  withText,
  hasTooltip,
  className,
}: MarketplaceCopyLinkProps) {
  const { t } = useTranslation(Translation.Marketplace);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const link =
    'authSettings' in entity
      ? getToolsetLink(entity)
      : getApplicationLink(entity);

  const { copied: urlCopied, onCopy } = useCopy(link);

  const handleCopy = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      e.stopPropagation();

      onCopy();
    },
    [onCopy],
  );

  return (
    <Tooltip
      tooltip={hasTooltip ? t(urlCopied ? 'Copied!' : 'Copy link') : undefined}
    >
      {urlCopied ? (
        <div
          className={classNames(TRIGGER_CLASS, className)}
          data-qa="copied-link"
        >
          <IconCheck size={size} data-qa="copied-icon" />
          {withText && <span>{t('Copied!')}</span>}
        </div>
      ) : (
        <a
          className={classNames(TRIGGER_CLASS, className)}
          onClick={handleCopy}
          data-qa="copy-link"
          href={link}
        >
          <IconLink size={size} data-qa="copy-icon" />
          {withText && <span data-qa="copy-link-text">{t('Copy link')}</span>}
        </a>
      )}
    </Tooltip>
  );
}

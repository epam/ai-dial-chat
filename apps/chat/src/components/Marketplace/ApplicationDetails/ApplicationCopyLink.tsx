import { IconCheck, IconLink } from '@tabler/icons-react';
import { MouseEvent, useCallback, useRef, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getApplicationLink } from '@/src/utils/marketplace';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import Tooltip from '../../Common/Tooltip';

interface ApplicationCopyLinkProps {
  entity: DialAIEntityModel;
  size?: number;
  withText?: boolean;
  hasTooltip?: boolean;
  className?: string;
}

const TRIGGER_CLASS =
  'flex items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-accent-primary outline-none';

export function ApplicationCopyLink({
  entity,
  size = 20,
  withText,
  hasTooltip,
  className,
}: ApplicationCopyLinkProps) {
  const { t } = useTranslation(Translation.Marketplace);
  const [urlCopied, setUrlCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const link = getApplicationLink(entity);
  const handleCopy = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!navigator.clipboard) return;

      navigator.clipboard.writeText(link).then(() => {
        setUrlCopied(true);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setUrlCopied(false);
        }, 2000);
      });
    },
    [link],
  );

  return (
    <Tooltip
      tooltip={hasTooltip ? t(urlCopied ? 'Copied!' : 'Copy link') : undefined}
    >
      {urlCopied ? (
        <div className={classNames(TRIGGER_CLASS, className)}>
          <IconCheck size={size} />
          {withText && <span>{t('Copied!')}</span>}
        </div>
      ) : (
        <a
          className={classNames(TRIGGER_CLASS, className)}
          onClick={handleCopy}
          data-qa="copy-link"
          href={link}
        >
          <IconLink size={size} />
          {withText && <span>{t('Copy link')}</span>}
        </a>
      )}
    </Tooltip>
  );
}

import { IconCheck, IconLink } from '@tabler/icons-react';
import { MouseEvent, useCallback, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { PageType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { MarketplaceQueryParams } from '@/src/constants/marketplace';

interface ApplicationCopyLinkProps {
  entity: DialAIEntityModel;
}

const ICON_SIZE = 20;
const TRIGGER_CLASS =
  'flex items-center gap-2 whitespace-nowrap px-3 py-1.5 text-sm text-accent-primary outline-none';

export function ApplicationCopyLink({ entity }: ApplicationCopyLinkProps) {
  const { t } = useTranslation(Translation.Marketplace);
  const [urlCopied, setUrlCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const link = useMemo(
    () =>
      `${window.location.origin}/${PageType.Marketplace}?${MarketplaceQueryParams.model}=${entity.reference}`,
    [entity.reference],
  );
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
    <>
      {urlCopied ? (
        <div className={TRIGGER_CLASS}>
          <IconCheck size={ICON_SIZE} />
          <span>{t('Copied!')}</span>
        </div>
      ) : (
        <a
          className={TRIGGER_CLASS}
          onClick={handleCopy}
          data-qa="copy-link"
          href={link}
        >
          <IconLink size={ICON_SIZE} />
          <span>{t('Copy link')}</span>
        </a>
      )}
    </>
  );
}

import type { FC } from 'react';
import { memo, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FooterMessageI18nKeys } from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { UserConfigStatus } from '../../types/user-config-status';
import { sanitizeFooterHtml } from '../../utils/footer-message';

const FooterMessage: FC = () => {
  const { t } = useTranslation();
  const {
    status,
    config: { footerHtmlMessage },
  } = useAppConfig();
  const isFooterEnabled = useFeatureFlag('footer');
  const sectionRef = useRef<HTMLElement>(null);

  const sanitizedHtml = useMemo(
    () =>
      isFooterEnabled && footerHtmlMessage
        ? sanitizeFooterHtml(footerHtmlMessage)
        : '',
    [isFooterEnabled, footerHtmlMessage],
  );

  const isVisible =
    status === UserConfigStatus.Ready && isFooterEnabled && !!sanitizedHtml;

  if (!isVisible) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      aria-label={t(FooterMessageI18nKeys.RegionAriaLabel)}
      className="dial-tiny-text w-full px-4 pb-4 pt-1 text-center text-secondary desktop:px-8 [&_a:hover]:opacity-75 [&_a]:underline"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

export default memo(FooterMessage);

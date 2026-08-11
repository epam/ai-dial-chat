import { mergeClasses } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FooterMessageI18nKeys } from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { UserConfigStatus } from '../../types/user-config-status';
import {
  formatAppVersion,
  sanitizeFooterHtml,
} from '../../utils/footer-message';

const FooterMessage: FC = () => {
  const { t } = useTranslation();
  const {
    status,
    config: { footerHtmlMessage, appVersion },
  } = useAppConfig();
  const isFooterEnabled = useFeatureFlag('footer');

  const sanitizedHtml = useMemo(
    () =>
      isFooterEnabled && footerHtmlMessage
        ? sanitizeFooterHtml(footerHtmlMessage)
        : '',
    [isFooterEnabled, footerHtmlMessage],
  );

  /* Defensive `?.`: this renders on every conversation route, so a config
   * payload missing the field must degrade to "no label", never crash the route
   * over cosmetic chrome. */
  const version = appVersion?.trim() ?? '';
  const isReady = status === UserConfigStatus.Ready;
  const isMessageVisible = isReady && isFooterEnabled && !!sanitizedHtml;
  /* Deliberately not gated by the `footer` flag: the version is diagnostic
   * chrome, not operator marketing copy. */
  const isVersionVisible = isReady && !!version;

  if (!isMessageVisible && !isVersionVisible) {
    return null;
  }

  return (
    <section
      aria-label={t(FooterMessageI18nKeys.RegionAriaLabel)}
      className="dial-tiny-text relative w-full px-4 pb-4 pt-1 text-center leading-5 text-secondary desktop:px-8"
    >
      {isMessageVisible && (
        <div
          className="[&_a:hover]:opacity-75 [&_a]:text-primary [&_a]:underline"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      )}
      {isVersionVisible && (
        <p
          className={mergeClasses(
            'pointer-events-none text-end',
            isMessageVisible && 'absolute bottom-4 end-4 desktop:end-8',
          )}
        >
          <span className="sr-only">
            {t(FooterMessageI18nKeys.VersionAriaLabel, { version })}
          </span>
          <span dir="ltr" aria-hidden>
            {formatAppVersion(version)}
          </span>
        </p>
      )}
    </section>
  );
};

export default memo(FooterMessage);

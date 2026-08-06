import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialCloseButton } from '@epam/ai-dial-ui-kit';
import { IconSpeakerphone } from '@tabler/icons-react';
import DOMPurify from 'dompurify';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnnouncementBannerI18nKeys } from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useAnnouncementDismissal } from '../../hooks/useAnnouncementDismissal/useAnnouncementDismissal';
import { UserConfigStatus } from '../../types/user-config-status';
import styles from './AnnouncementBanner.module.scss';

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ['a', 'b', 'strong', 'em', 'br', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
};

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

interface Props {
  className?: string;
}

const AnnouncementBanner: FC<Props> = ({ className }) => {
  const { t } = useTranslation();
  const {
    status,
    config: { announcementHtml },
  } = useAppConfig();
  const { dismissedText, dismiss } = useAnnouncementDismissal();

  const shouldRender =
    status === UserConfigStatus.Ready &&
    !!announcementHtml &&
    dismissedText !== announcementHtml;

  const sanitizedHtml = useMemo(
    () =>
      shouldRender && announcementHtml
        ? DOMPurify.sanitize(announcementHtml, SANITIZE_OPTIONS)
        : '',
    [shouldRender, announcementHtml],
  );

  const isVisible = shouldRender && !!sanitizedHtml;

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={t(AnnouncementBannerI18nKeys.RegionAriaLabel)}
      className={mergeClasses(
        styles.root,
        'flex items-center justify-center gap-3 px-4 py-2 text-control-permanent',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
        <span className="shrink-0">
          <IconSpeakerphone size={24} stroke={1.5} aria-hidden />
        </span>
        <span
          className="text-center text-sm font-semibold"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </div>
      <DialCloseButton
        ariaLabel={t(AnnouncementBannerI18nKeys.CloseLabel)}
        onClose={() => dismiss(announcementHtml ?? '')}
        size={16}
        className="shrink-0 rounded bg-backdrop p-[3px] !text-control-permanent"
      />
    </div>
  );
};

export default memo(AnnouncementBanner);

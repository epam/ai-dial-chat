import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, StaticIconButton } from '@epam/ai-dial-ui-kit';
import { IconX } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnnouncementBannerI18nKeys } from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useAnnouncementDismissal } from '../../hooks/useAnnouncementDismissal/useAnnouncementDismissal';
import { UserConfigStatus } from '../../types/user-config-status';
import type { AnnouncementContent } from '../../utils/announcement-message';
import {
  hasAnnouncementContent,
  hasStructuredAnnouncement,
  sanitizeAnnouncementHtml,
} from '../../utils/announcement-message';
import AnnouncementsPopover from '../AnnouncementsPopover/AnnouncementsPopover';

interface Props {
  className?: string;
}

const AnnouncementBanner: FC<Props> = ({ className }) => {
  const { t } = useTranslation();
  const {
    status,
    config: {
      announcementHtml,
      announcementTitle,
      announcementDescription,
      announcements,
    },
  } = useAppConfig();

  const content = useMemo<AnnouncementContent>(
    () => ({
      title: announcementTitle,
      description: announcementDescription,
      html: announcementHtml,
    }),
    [announcementTitle, announcementDescription, announcementHtml],
  );

  const { isDismissed, dismiss } = useAnnouncementDismissal(content);

  const isStructured = hasStructuredAnnouncement(content);
  const shouldRender =
    status === UserConfigStatus.Ready &&
    hasAnnouncementContent(content) &&
    !isDismissed;

  /* Sanitized in the app layer even though the backend already sanitizes, so
   * the component stays safe against an older backend that does not. */
  const sanitizedDescription = useMemo(
    () =>
      shouldRender && isStructured && announcementDescription
        ? sanitizeAnnouncementHtml(announcementDescription)
        : '',
    [shouldRender, isStructured, announcementDescription],
  );

  const sanitizedHtml = useMemo(
    () =>
      shouldRender && !isStructured && announcementHtml
        ? sanitizeAnnouncementHtml(announcementHtml)
        : '',
    [shouldRender, isStructured, announcementHtml],
  );

  const closeButton = (
    <StaticIconButton
      icon={<IconX stroke={1.5} size={DIAL_ICON_SIZE.LG} aria-hidden />}
      aria-label={t(AnnouncementBannerI18nKeys.CloseLabel)}
      onClick={dismiss}
    />
  );

  if (isStructured) {
    const hasVisibleContent = !!announcementTitle || !!sanitizedDescription;

    if (!shouldRender || !hasVisibleContent) {
      return null;
    }

    return (
      <div
        role="region"
        aria-label={
          announcementTitle
            ? t(AnnouncementBannerI18nKeys.RegionAriaLabelWithTitle, {
                title: announcementTitle,
              })
            : t(AnnouncementBannerI18nKeys.RegionAriaLabel)
        }
        className={mergeClasses(
          'flex items-center gap-4 border-b border-tertiary bg-layer-base px-4 py-2 text-primary desktop:px-14',
          className,
        )}
      >
        <p className="dial-small-paragraph-text flex min-w-0 flex-1 flex-row gap-4 text-start">
          {announcementTitle && (
            <span className="dial-small-paragraph-semi-text min-w-0 truncate">
              {announcementTitle}
            </span>
          )}
          {sanitizedDescription && (
            <span
              className="min-w-0 truncate"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          )}
        </p>
        <AnnouncementsPopover announcements={announcements} />
        {closeButton}
      </div>
    );
  }

  if (!shouldRender || !sanitizedHtml) {
    return null;
  }

  /* Legacy layout: a deployment that configures only ANNOUNCEMENT_HTML_MESSAGE
   * keeps the centered single line and its dismissal behaviour — no
   * title/description split, no announcements pill. The surface tokens follow
   * the redesign rather than preserving the old gradient and megaphone icon,
   * so the app does not ship two visual languages at once. */
  return (
    <div
      role="region"
      aria-label={t(AnnouncementBannerI18nKeys.RegionAriaLabel)}
      className={mergeClasses(
        'flex items-center justify-center gap-3 border-b border-tertiary bg-layer-base px-4 py-2 text-primary',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
        <span
          className="dial-small-paragraph-semi-text"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </div>
      {closeButton}
    </div>
  );
};

export default memo(AnnouncementBanner);

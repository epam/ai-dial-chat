import {
  hasAnnouncementContent,
  hasStructuredAnnouncement,
  sanitizeAnnouncementHtml,
  sanitizeAnnouncementMessageHtml,
  type AnnouncementContent,
} from '@epam/ai-dial-chat-hooks';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  StaticIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconX } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnnouncementBannerI18nKeys } from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useAnnouncementDismissal } from '../../hooks/useAnnouncementDismissal/useAnnouncementDismissal';
import { useIsTextClipped } from '../../hooks/useIsTextClipped/useIsTextClipped';
import { UserConfigStatus } from '../../types/user-config-status';
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

  /* `items` is part of the content, not decoration: the popover lives inside
     the banner and is hidden along with it, so a new entry in the list has to
     bring a dismissed banner back the same way a new title does. */
  const content = useMemo<AnnouncementContent>(
    () => ({
      title: announcementTitle,
      description: announcementDescription,
      html: announcementHtml,
      items: announcements,
    }),
    [
      announcementTitle,
      announcementDescription,
      announcementHtml,
      announcements,
    ],
  );

  const { isDismissed, dismiss } = useAnnouncementDismissal(content);
  const [isExpanded, setIsExpanded] = useState(false);
  const textId = useId();

  const handleToggleExpanded = useCallback(
    () => setIsExpanded((wasExpanded) => !wasExpanded),
    [],
  );

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
        ? sanitizeAnnouncementMessageHtml(announcementHtml)
        : '',
    [shouldRender, isStructured, announcementHtml],
  );

  /* Title and description clip independently — each is a flex item with its
     own ellipsis — so each has to be asked separately whether it is hiding
     anything. */
  const { ref: titleRef, isClipped: isTitleClipped } =
    useIsTextClipped<HTMLSpanElement>(!isExpanded, announcementTitle ?? '');
  const { ref: descriptionRef, isClipped: isDescriptionClipped } =
    useIsTextClipped<HTMLSpanElement>(!isExpanded, sanitizedDescription);

  const isTextClipped = isTitleClipped || isDescriptionClipped;

  const closeButton = (
    <StaticIconButton
      icon={
        <IconX
          stroke={DIAL_KIT_ICON_STROKE}
          size={DIAL_ICON_SIZE.LG}
          aria-hidden
        />
      }
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
          'flex gap-4 border-b border-tertiary bg-layer-base px-4 py-2 text-primary desktop:px-14',
          /* Expanded, the text is several lines tall and the controls belong
             beside its first line rather than floating at its middle. */
          isExpanded ? 'items-start' : 'items-center',
          className,
        )}
      >
        <p
          id={textId}
          className={mergeClasses(
            'dial-small-paragraph-text flex min-w-0 flex-1 text-start',
            /* Collapsed, title and description share one line, each clipped to
               its own ellipsis. Expanded, they stack and wrap freely — the
               whole point of the state is that nothing is cut off. */
            isExpanded ? 'flex-col gap-1' : 'flex-row gap-4',
          )}
        >
          {announcementTitle && (
            <span
              ref={titleRef}
              className={mergeClasses(
                'dial-small-paragraph-semi-text min-w-0',
                !isExpanded && 'truncate',
              )}
            >
              {announcementTitle}
            </span>
          )}
          {sanitizedDescription && (
            /* Links must read as links: both sanitizers strip `style` and
               `class`, so nothing an operator writes in ANNOUNCEMENT_DESCRIPTION
               can colour them — the wrapper has to.

               `flex-1` (basis 0) makes the description yield the shared line to
               the title rather than shrinking alongside it: with an auto basis
               both spans shrink in proportion, leaving the description a sliver
               of ellipsis instead of collapsing out of view. It applies only
               while the two share a line — stacked, a zero basis would fight
               the wrapped text for height. */
            <span
              ref={descriptionRef}
              className={mergeClasses(
                'min-w-0 [&_a:hover]:opacity-75 [&_a]:text-accent [&_a]:underline',
                !isExpanded && 'flex-1 truncate',
              )}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          )}
        </p>
        {/* Rendered only once something is actually hidden: a disclosure that
            reveals nothing is noise on a strip this small. The chevron is
            symmetric about the vertical axis, so it needs no rtl mirroring. */}
        {isTextClipped && (
          <StaticIconButton
            className="shrink-0"
            icon={
              <IconChevronDown
                stroke={DIAL_KIT_ICON_STROKE}
                size={DIAL_ICON_SIZE.LG}
                className={isExpanded ? 'rotate-180' : undefined}
                aria-hidden
              />
            }
            aria-label={t(
              isExpanded
                ? AnnouncementBannerI18nKeys.CollapseLabel
                : AnnouncementBannerI18nKeys.ExpandLabel,
            )}
            aria-expanded={isExpanded}
            aria-controls={textId}
            onClick={handleToggleExpanded}
          />
        )}
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
   * title/description split, no announcements pill. It wraps rather than
   * clips, so it needs no disclosure control. The surface tokens follow the
   * redesign rather than preserving the old gradient and megaphone icon, so
   * the app does not ship two visual languages at once. */
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
        {/* A div, not a span: the legacy message may contain <p> blocks, which
            are invalid inside a span and get reparented by the browser. Links
            are coloured and underlined here rather than via operator-authored
            style attributes, which the sanitizer strips. */}
        <div
          className="dial-small-paragraph-semi-text text-center [&>p+p]:mt-1 [&_a:hover]:opacity-75 [&_a]:text-accent [&_a]:underline"
          // eslint-disable-next-line react/no-danger -- HTML is sanitized by DOMPurify before use
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </div>
      {closeButton}
    </div>
  );
};

export default memo(AnnouncementBanner);

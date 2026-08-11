import { Dropdown, NeutralButton } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnnouncementsPopoverI18nKeys } from '../../constants/translation-keys';
import type { AnnouncementItem } from '../../models/announcement';
import { sanitizeAnnouncementHtml } from '../../utils/announcement-message';

const MAX_POPOVER_HEIGHT = 420;

interface Props {
  announcements: AnnouncementItem[];
}

const AnnouncementsPopover: FC<Props> = ({ announcements }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const overlayId = useId();
  const pillId = useId();

  /* Escape is handled here rather than left to the overlay so focus lands back
   * on the pill — Floating UI closes the panel but does not restore focus to a
   * trigger it does not own. Bound to the document because the overlay renders
   * in a portal, so a wrapper element would not reliably see the key event.
   *
   * The pill is looked up by id rather than held in a ref: it is a ui-kit
   * component, and whether it forwards a ref to its underlying <button> is its
   * implementation detail, not a contract this component should depend on. */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        document.getElementById(pillId)?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pillId]);

  if (announcements.length === 0) {
    return null;
  }

  const renderOverlay = () => (
    <section
      id={overlayId}
      aria-label={t(AnnouncementsPopoverI18nKeys.ListAriaLabel)}
      className="max-w-[420px]"
    >
      {/* `divide-y` puts the rule on every item but the first, so no separator
          hangs at the top or bottom of the list. Vertical borders need no
          logical-property treatment — they do not flip under rtl. */}
      <ul className="flex flex-col divide-y divide-tertiary">
        {announcements.map((announcement, index) => {
          const description = announcement.description
            ? sanitizeAnnouncementHtml(announcement.description)
            : '';

          return (
            <li
              key={`${announcement.title}-${index}`}
              className="flex items-start gap-3 px-3 py-2 text-start"
            >
              <div className="min-w-0 flex-1">
                <p className="dial-small-paragraph-semi-text text-primary">
                  {announcement.title}
                </p>
                {description && (
                  <p
                    className="dial-small-paragraph-text text-secondary"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                )}
              </div>

              {announcement.link && (
                <a
                  href={announcement.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dial-small-paragraph-semi-text shrink-0 text-accent hover:underline focus-visible:underline"
                >
                  {announcement.link.label}
                  <span className="sr-only">
                    {` ${t(AnnouncementsPopoverI18nKeys.OpensInNewTab)}`}
                  </span>
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <div className="shrink-0">
      <Dropdown
        open={isOpen}
        onOpenChange={setIsOpen}
        placement="bottom-end"
        matchReferenceWidth={false}
        maxDropdownHeight={MAX_POPOVER_HEIGHT}
        renderOverlay={renderOverlay}
      >
        <NeutralButton
          id={pillId}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-controls={overlayId}
          label={t(AnnouncementsPopoverI18nKeys.PillLabel, {
            count: announcements.length,
          })}
        />
      </Dropdown>
    </div>
  );
};

export default memo(AnnouncementsPopover);

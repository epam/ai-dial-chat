import {
  sanitizeAnnouncementHtml,
  type AnnouncementListItem,
} from '@epam/ai-dial-chat-hooks';
import {
  Dropdown,
  DropdownOverlayRole,
  LinkButton,
  NeutralButton,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnnouncementsPopoverI18nKeys } from '../../constants/translation-keys';

const MAX_POPOVER_HEIGHT = 420;

interface Props {
  announcements: AnnouncementListItem[];
}

const AnnouncementsPopover: FC<Props> = ({ announcements }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  if (announcements.length === 0) {
    return null;
  }

  const renderOverlay = () => (
    /* tabIndex makes the region focusable so a keyboard-only user can reach the
     * scroll container and page through rows with the arrow keys. Rows are not
     * guaranteed to contain a link, so tabbing between links is not a
     * sufficient way to scroll the list. Being the first tabbable element in
     * the overlay, it is also where the Dropdown's click-open focus lands, so
     * the whole list sits one step ahead in the reading order. */
    <section
      aria-label={t(AnnouncementsPopoverI18nKeys.ListAriaLabel)}
      className="max-w-[420px]"
      tabIndex={0}
    >
      {/* `divide-y` puts the rule on every item but the last, so no separator
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
                <LinkButton
                  href={announcement.link.href}
                  target="_blank"
                  className="h-auto shrink-0"
                  label={
                    <>
                      {announcement.link.label}
                      <span className="sr-only">
                        {` ${t(AnnouncementsPopoverI18nKeys.OpensInNewTab)}`}
                      </span>
                    </>
                  }
                />
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
        /* `maxDropdownHeight` only caps the floating panel — the ui-kit's 2.0
         * Dropdown leaves that panel's overflow at the default, so without this
         * every row past the cap renders outside the panel, on top of the page.
         * The class has to land on the floating overlay itself, because that is
         * the element carrying the max height, and `listClassName` is the prop
         * that targets it. */
        listClassName="overflow-y-auto"
        /* The panel is a named region of announcements, not a menu of actions:
         * a role-less overlay keeps the section's own region semantics and lets
         * Tab move between row links. The Dropdown still sets aria-expanded and
         * aria-controls on the pill, and returns focus to it on Escape. */
        overlayRole={DropdownOverlayRole.None}
        renderOverlay={renderOverlay}
      >
        <NeutralButton
          label={t(AnnouncementsPopoverI18nKeys.PillLabel, {
            count: announcements.length,
          })}
        />
      </Dropdown>
    </div>
  );
};

export default memo(AnnouncementsPopover);

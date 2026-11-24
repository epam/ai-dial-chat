import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  FormSection,
  LiveRegion,
  NeutralButton,
  Notification,
  NotificationType,
  NotificationVariant,
  Tag,
  TagAppearance,
} from '@epam/ai-dial-ui-kit';
import { IconPlus } from '@tabler/icons-react';
import { useEffect, useRef, useState, type FC } from 'react';
import { AccessLevel, type AccessEntry } from '../../models/access';
import type { AccessFieldProps } from '../../models/access-field-props';
import { AccessModal } from '../AccessModal/AccessModal';
import styles from './AccessField.module.scss';

/** Access section: a titled form section with a Configure action, entry chips and an approval notice. */
export const AccessField: FC<AccessFieldProps> = ({
  value,
  onChange,
  contentOptions,
  readOnlyChips = [],
  noticeText,
  labels,
  className,
  titleClassName,
  descriptionClassName,
  chipClassName = 'dial-tiny-text',
  colors,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const configureButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  const levelLabels: Record<AccessLevel, string> = {
    [AccessLevel.Read]: labels.accessRead,
    [AccessLevel.ReadWrite]: labels.accessReadWrite,
  };
  const getEntryLabel = (entry: AccessEntry): string => {
    const contentLabel =
      contentOptions.find((option) => option.id === entry.contentId)?.label ??
      entry.contentId;
    return `${contentLabel}: ${levelLabels[entry.level]}`;
  };

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) configureButtonRef.current?.focus();
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const handleOpen = (): void => setIsOpen(true);
  const handleClose = (): void => setIsOpen(false);

  const applyEntries = (entries: AccessEntry[]): void => {
    const previousIds = new Set(value.map((entry) => entry.contentId));
    const currentIds = new Set(entries.map((entry) => entry.contentId));
    const messages = [
      ...entries
        .filter((entry) => !previousIds.has(entry.contentId))
        .map((entry) => labels.announceAdded(getEntryLabel(entry))),
      ...value
        .filter((entry) => !currentIds.has(entry.contentId))
        .map((entry) => labels.announceRemoved(getEntryLabel(entry))),
    ];
    if (messages.length > 0) setAnnouncement(messages.join('. '));
    onChange(entries);
  };

  const handleSave = (entries: AccessEntry[]): void => {
    applyEntries(entries);
    setIsOpen(false);
  };

  const handleRemove = (contentId: string): void => {
    applyEntries(value.filter((entry) => entry.contentId !== contentId));
    configureButtonRef.current?.focus();
  };

  const hasEntries = value.length > 0 || readOnlyChips.length > 0;
  const cssVars = buildCssVars({ '--af-chip-text': colors?.chipText });

  return (
    <FormSection
      title={labels.title}
      description={labels.description}
      className={className}
      titleClassName={titleClassName}
      descriptionClassName={descriptionClassName}
      action={
        <NeutralButton
          ref={configureButtonRef}
          size={ElementSize.Small}
          iconBefore={
            <IconPlus
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          label={labels.configureLabel}
          onClick={handleOpen}
        />
      }
    >
      <div className="flex flex-col gap-3">
        {hasEntries && (
          <ul
            className="m-0 flex list-none flex-wrap gap-2 p-0"
            style={cssVars}
          >
            {value.map((entry) => {
              const entryLabel = getEntryLabel(entry);
              return (
                <li key={entry.contentId}>
                  <Tag
                    label={entryLabel}
                    appearance={TagAppearance.Bordered}
                    className={mergeClasses(chipClassName, styles.chip)}
                    closable
                    removeLabel={labels.removeEntry(entryLabel)}
                    onRemove={() => handleRemove(entry.contentId)}
                  />
                </li>
              );
            })}
            {readOnlyChips.map((chip) => (
              <li key={chip.id}>
                <Tag
                  label={chip.label}
                  appearance={TagAppearance.Bordered}
                  className={mergeClasses(chipClassName, styles.chip)}
                />
              </li>
            ))}
          </ul>
        )}

        {hasEntries && noticeText != null && noticeText !== '' && (
          <Notification
            variant={NotificationVariant.Info}
            type={NotificationType.SectionMessage}
            message={noticeText}
          />
        )}

        <LiveRegion visuallyHidden>{announcement}</LiveRegion>
      </div>

      <AccessModal
        open={isOpen}
        value={value}
        contentOptions={contentOptions}
        labels={labels}
        colors={colors}
        onSave={handleSave}
        onClose={handleClose}
      />
    </FormSection>
  );
};

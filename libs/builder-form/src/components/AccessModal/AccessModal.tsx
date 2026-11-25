import {
  AccessLevel,
  buildCssVars,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonVariant,
  DangerIconButton,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  Popup,
  Select,
} from '@epam/ai-dial-ui-kit';
import { IconTrashX } from '@tabler/icons-react';
import { useId, useState, type FC } from 'react';
import type { AccessContentOption } from '../../models/access';
import type { AccessModalProps } from '../../models/access-field-props';
import {
  buildAccessDraft,
  isDraftCardEmpty,
  resetLevelForOption,
  toAccessEntries,
  withTrailingCard,
  type AccessDraftCard,
} from '../../utils/access-draft';
import styles from './AccessModal.module.scss';

const cardName = (
  prefix: string,
  index: number,
  option: AccessContentOption | undefined,
): string =>
  option == null
    ? `${prefix} ${index + 1}`
    : `${prefix} ${index + 1}: ${option.label}`;

/** Modal that edits a draft copy of the access entries and applies it on save. */
export const AccessModal: FC<AccessModalProps> = ({
  open,
  value,
  contentOptions,
  labels,
  onSave,
  onClose,
  className,
  colors,
}) => {
  const baseId = useId();
  const cssVars = buildCssVars({
    '--am-card-bg': colors?.cardBackground,
    '--am-card-border': colors?.cardBorder,
  });
  const [draft, setDraft] = useState<AccessDraftCard[]>(() =>
    buildAccessDraft(value),
  );
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(buildAccessDraft(value));
  }

  const handleSave = (): void => {
    onSave(toAccessEntries(draft));
  };

  const handleContentChange = (cardId: string, contentId: string): void => {
    const option = contentOptions.find((item) => item.id === contentId);
    setDraft((previous) =>
      withTrailingCard(
        previous.map((card) =>
          card.id === cardId
            ? {
                ...card,
                contentId,
                level: resetLevelForOption(option, card.level),
              }
            : card,
        ),
      ),
    );
  };

  const handleLevelChange = (cardId: string, level: AccessLevel): void => {
    setDraft((previous) =>
      withTrailingCard(
        previous.map((card) =>
          card.id === cardId ? { ...card, level } : card,
        ),
      ),
    );
  };

  const handleDelete = (cardId: string): void => {
    setDraft((previous) => {
      const card = previous.find((item) => item.id === cardId);
      const isTrailing = previous[previous.length - 1]?.id === cardId;
      if (card == null || (isTrailing && isDraftCardEmpty(card))) {
        return previous;
      }
      return withTrailingCard(previous.filter((item) => item.id !== cardId));
    });
  };

  const levelLabels: Record<AccessLevel, string> = {
    [AccessLevel.Read]: labels.accessRead,
    [AccessLevel.ReadWrite]: labels.accessReadWrite,
  };

  return (
    <Popup
      open={open}
      header={labels.modalTitle}
      headerDivider
      footerDivider
      className={className}
      closeAriaLabel={labels.closeAriaLabel}
      closeOnOutsideClick={false}
      onClose={onClose}
      mainButtons={[
        { label: labels.cancelLabel, onClick: onClose },
        {
          label: labels.saveLabel,
          variant: ButtonVariant.Primary,
          onClick: handleSave,
        },
      ]}
    >
      {/* The popup renders in a portal, outside the root that carries the vars. */}
      <div className="flex flex-col gap-4 px-6 py-4" style={cssVars}>
        {draft.map((card, index) => {
          const usedByOtherCards = new Set(
            draft
              .filter((other) => other.id !== card.id)
              .map((other) => other.contentId)
              .filter(Boolean),
          );
          const selectedOption = contentOptions.find(
            (option) => option.id === card.contentId,
          );

          return (
            <div
              key={card.id}
              role="group"
              aria-label={cardName(labels.modalTitle, index, selectedOption)}
              className={mergeClasses(
                'flex flex-col gap-3 rounded border p-3 desktop:flex-row desktop:items-start',
                styles.card,
              )}
            >
              <Select
                id={`${baseId}-${card.id}-content`}
                className="min-w-0 flex-1"
                ariaLabel={labels.selectContent}
                placeholder={labels.selectContent}
                options={contentOptions.map((option) => ({
                  value: option.id,
                  label: option.label,
                  disabled: usedByOtherCards.has(option.id),
                }))}
                value={card.contentId}
                onChange={(next) =>
                  handleContentChange(card.id, next as string)
                }
              />
              <Select
                id={`${baseId}-${card.id}-level`}
                className="min-w-0 flex-1"
                ariaLabel={labels.selectAccess}
                placeholder={labels.selectAccess}
                disabled={selectedOption == null}
                options={(selectedOption?.allowedAccess ?? []).map((level) => ({
                  value: level,
                  label: levelLabels[level],
                }))}
                value={card.level}
                onChange={(next) =>
                  handleLevelChange(card.id, next as AccessLevel)
                }
              />
              <DangerIconButton
                appearance={ButtonAppearance.Ghost}
                size={ElementSize.Small}
                className="self-end desktop:self-center"
                icon={
                  <IconTrashX
                    size={DIAL_ICON_SIZE.SM}
                    aria-hidden
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                }
                aria-label={cardName(labels.deleteCard, index, selectedOption)}
                onClick={() => handleDelete(card.id)}
              />
            </div>
          );
        })}
      </div>
    </Popup>
  );
};

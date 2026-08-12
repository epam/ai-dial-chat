import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  DIAL_ICON_SIZE,
  DialDangerIconButton,
  DialFormPopup,
  DialSelectField,
  ElementSize,
  Input,
  LinkButton,
  Textarea,
} from '@epam/ai-dial-ui-kit';
import { IconPencil, IconPlus, IconTrashX } from '@tabler/icons-react';
import { useEffect, useRef, useState, type FC } from 'react';
import type {
  DeploymentCreationFormLocaleEntry,
  DeploymentCreationFormLocaleLabels,
  DeploymentCreationFormLocaleOption,
} from '../../models/deployment-creation-form';

/** Props accepted by the `DeploymentLocalesField` component. */
export interface DeploymentLocalesFieldProps {
  /** Current list of additional (non-primary) locale entries. */
  value: DeploymentCreationFormLocaleEntry[];
  /** Called with the full updated list when the user saves changes in the popup. */
  onChange: (entries: DeploymentCreationFormLocaleEntry[]) => void;
  /** Selectable language options for new/existing rows. Defaults to an empty list (no locales addable). */
  availableLocaleOptions?: DeploymentCreationFormLocaleOption[];
  /** Pre-translated labels for the summary row and popup. */
  labels: DeploymentCreationFormLocaleLabels;
  /** Class applied to the summary row container. */
  className?: string;
  /** Typography and color class applied to the summary text. Defaults to `'dial-body-text text-secondary'`. */
  summaryClassName?: string;
  /** Typography and color class applied to each row's heading. Defaults to `'dial-tiny-lead-text text-secondary'`, which uppercases the label itself. */
  rowLabelClassName?: string;
  /** Color class applied to the required-field asterisk on the per-locale name field. Defaults to `'text-error'`. */
  requiredMarkClassName?: string;
}

const createEmptyRow = (
  id: string,
  usedLanguages: ReadonlySet<string>,
  availableLocaleOptions: DeploymentCreationFormLocaleOption[],
): DeploymentCreationFormLocaleEntry => ({
  id,
  language:
    availableLocaleOptions.find((option) => !usedLanguages.has(option.code))
      ?.code ?? '',
  name: '',
  description: '',
});

/** Summary row ("Locales: [DE]  Edit") plus the "Add locale" popup for editing additional name/description translations. */
export const DeploymentLocalesField: FC<DeploymentLocalesFieldProps> = ({
  value,
  onChange,
  availableLocaleOptions = [],
  labels,
  className,
  summaryClassName = 'dial-body-text text-secondary',
  rowLabelClassName = 'dial-tiny-lead-text text-secondary',
  requiredMarkClassName = 'text-error',
}) => {
  const {
    summaryLabel,
    editLabel,
    popupTitle,
    addLocaleLabel,
    localeRowLabel = 'Locale',
    languageLabel,
    nameLabel,
    namePlaceholder,
    descriptionLabel,
    descriptionPlaceholder,
    deleteAriaLabel,
    cancelLabel = 'Cancel',
    saveLabel = 'Save',
  } = labels;

  const [isOpen, setIsOpen] = useState(false);
  const [draftEntries, setDraftEntries] = useState<
    DeploymentCreationFormLocaleEntry[]
  >([]);

  const nextRowIdRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setDraftEntries(
        value.length > 0
          ? value
          : [
              createEmptyRow(
                `locale-row-${++nextRowIdRef.current}`,
                new Set(),
                availableLocaleOptions,
              ),
            ],
      );
    }
  }, [isOpen, value, availableLocaleOptions]);

  const handleOpen = (): void => setIsOpen(true);
  const handleCancel = (): void => setIsOpen(false);

  const handleSave = (): void => {
    onChange(draftEntries.filter((entry) => entry.language && entry.name));
    setIsOpen(false);
  };

  const handleAddRow = (): void => {
    const usedLanguages = new Set(
      draftEntries.map((entry) => entry.language).filter(Boolean),
    );
    setDraftEntries((prev) => [
      ...prev,
      createEmptyRow(
        `locale-row-${++nextRowIdRef.current}`,
        usedLanguages,
        availableLocaleOptions,
      ),
    ]);
  };

  const handleRowChange = (
    id: string,
    patch: Partial<Omit<DeploymentCreationFormLocaleEntry, 'id'>>,
  ): void => {
    setDraftEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const handleRowDelete = (id: string): void => {
    setDraftEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const localeLabel = (code: string): string =>
    availableLocaleOptions.find((option) => option.code === code)?.label ??
    code.toUpperCase();

  const isSaveDisabled = draftEntries.some(
    (entry) => !entry.language || !entry.name,
  );

  return (
    <div className={mergeClasses('flex items-center gap-2', className)}>
      <span className={summaryClassName}>
        {`${summaryLabel}: ${
          value.length > 0
            ? value
                .map((entry) => `[${localeLabel(entry.language)}]`)
                .join(', ')
            : '—'
        }`}
      </span>
      <LinkButton
        label={editLabel}
        iconBefore={<IconPencil size={DIAL_ICON_SIZE.SM} aria-hidden />}
        className="!px-0"
        onClick={handleOpen}
      />

      <DialFormPopup
        open={isOpen}
        header={popupTitle}
        dividers={false}
        onClose={handleCancel}
        onCancel={handleCancel}
        onSubmit={handleSave}
        cancelLabel={cancelLabel}
        submitLabel={saveLabel}
        disableSubmitButton={isSaveDisabled}
      >
        <div className="flex flex-col gap-8 px-6 py-3">
          {draftEntries.map((entry, index) => {
            const usedByOtherRows = new Set(
              draftEntries
                .filter((other) => other.id !== entry.id)
                .map((other) => other.language)
                .filter(Boolean),
            );

            return (
              <div key={entry.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className={rowLabelClassName}>
                    {localeRowLabel} {index + 1}
                  </span>
                  <DialDangerIconButton
                    appearance={ButtonAppearance.Ghost}
                    size={ElementSize.Small}
                    icon={<IconTrashX size={DIAL_ICON_SIZE.SM} aria-hidden />}
                    aria-label={`${deleteAriaLabel} ${index + 1}`}
                    onClick={() => handleRowDelete(entry.id)}
                  />
                </div>

                <div
                  role="group"
                  aria-label={`${localeRowLabel} ${index + 1}`}
                  className="flex flex-col gap-5"
                >
                  <div className="flex items-start gap-5">
                    <DialSelectField
                      id={`${entry.id}-language`}
                      label={languageLabel}
                      containerClassName="w-20 shrink-0"
                      options={availableLocaleOptions.map((option) => ({
                        value: option.code,
                        label: option.label,
                        disabled: usedByOtherRows.has(option.code),
                      }))}
                      value={entry.language}
                      onChange={(next) =>
                        handleRowChange(entry.id, {
                          language: next as string,
                        })
                      }
                    />

                    <Input
                      id={`${entry.id}-name`}
                      containerClassName="min-w-0 flex-1"
                      required
                      value={entry.name}
                      onChange={(next) =>
                        handleRowChange(entry.id, { name: next ?? '' })
                      }
                      labelProps={{
                        label: (
                          <>
                            {nameLabel}
                            <span aria-hidden className={requiredMarkClassName}>
                              *
                            </span>
                          </>
                        ),
                      }}
                      placeholder={namePlaceholder}
                    />
                  </div>

                  <Textarea
                    id={`${entry.id}-description`}
                    resize
                    value={entry.description}
                    onChange={(next) =>
                      handleRowChange(entry.id, { description: next })
                    }
                    labelProps={{ label: descriptionLabel }}
                    placeholder={descriptionPlaceholder}
                  />
                </div>
              </div>
            );
          })}
          <LinkButton
            label={addLocaleLabel}
            iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} aria-hidden />}
            className="self-start"
            onClick={handleAddRow}
            disabled={draftEntries.length >= availableLocaleOptions.length}
          />
        </div>
      </DialFormPopup>
    </div>
  );
};

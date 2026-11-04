import {
  buildCssVars,
  mergeClasses,
  RESIZABLE_TEXTAREA_CLASS_NAME,
} from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonVariant,
  DangerIconButton,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  Input,
  LinkButton,
  Popup,
  Select,
  Textarea,
  TextareaResize,
} from '@epam/ai-dial-ui-kit';
import { IconPlus, IconTrashX } from '@tabler/icons-react';
import { useEffect, useRef, useState, type FC } from 'react';
import type {
  DeploymentCreationFormLocaleEntry,
  DeploymentCreationFormLocaleLabels,
  DeploymentCreationFormLocaleOption,
  DeploymentLocalesFieldColors,
} from '../../models/deployment-creation-form';
import styles from './DeploymentLocalesField.module.scss';

/** Props accepted by the `DeploymentLocalesField` component. */
export interface DeploymentLocalesFieldProps {
  /** Current list of additional (non-primary) locale entries. */
  value: DeploymentCreationFormLocaleEntry[];
  /** Called with the full updated list when the user saves changes in the popup. */
  onChange: (entries: DeploymentCreationFormLocaleEntry[]) => void;
  /** Selectable language options for new/existing rows. Defaults to an empty list; with no options and no retained entry in `value` the whole control renders nothing. */
  availableLocaleOptions?: DeploymentCreationFormLocaleOption[];
  /** Labels a retained code — an entry language that is not in `availableLocaleOptions`. Defaults to `code.toUpperCase()`. */
  formatLocaleLabel?: (code: string) => string;
  /** Pre-translated labels for the summary row and popup. */
  labels: DeploymentCreationFormLocaleLabels;
  /** Class applied to the summary row container. */
  className?: string;
  /** Typography class applied to the summary text. Defaults to `'dial-body-text'`. */
  summaryClassName?: string;
  /** Typography class applied to each row's heading. Defaults to `'dial-tiny-lead-text'`, which uppercases the label itself. */
  rowLabelClassName?: string;
  /** Color overrides, applied as CSS custom properties. */
  colors?: DeploymentLocalesFieldColors;
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

const defaultFormatLocaleLabel = (code: string): string => code.toUpperCase();

/** Summary row ("Locales: [DE]  Edit locales") plus the "Add locale" popup for editing additional name/description translations; renders nothing when there is no option and no retained entry. */
export const DeploymentLocalesField: FC<DeploymentLocalesFieldProps> = ({
  value,
  onChange,
  availableLocaleOptions = [],
  formatLocaleLabel = defaultFormatLocaleLabel,
  labels,
  className,
  summaryClassName = 'dial-body-text',
  rowLabelClassName = 'dial-tiny-lead-text',
  colors,
}) => {
  const cssVars = buildCssVars({
    '--dlf-summary-text': colors?.summaryText,
    '--dlf-row-label-text': colors?.rowLabelText,
  });
  const {
    summaryLabel,
    addLabel,
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

  const configuredCodes = new Set(
    availableLocaleOptions.map((option) => option.code),
  );
  const isRetained = (code: string): boolean =>
    code !== '' && !configuredCodes.has(code);
  const hasRetainedEntry = value.some((entry) => isRetained(entry.language));
  const usedConfiguredCount = new Set(
    draftEntries
      .map((entry) => entry.language)
      .filter((code) => configuredCodes.has(code)),
  ).size;

  /*
   * A retained row lists its own stored code (and its current one, if that is
   * also unconfigured) next to the configured options, so it can be kept or
   * switched. No other row is ever offered that code.
   */
  const buildLanguageOptions = (
    entry: DeploymentCreationFormLocaleEntry,
    usedByOtherRows: ReadonlySet<string>,
  ) => {
    const storedLanguage = value.find(
      (stored) => stored.id === entry.id,
    )?.language;
    const retainedCodes = [
      ...new Set([storedLanguage ?? '', entry.language].filter(isRetained)),
    ];
    return [
      ...availableLocaleOptions.map((option) => ({
        value: option.code,
        label: option.label,
        disabled: usedByOtherRows.has(option.code),
      })),
      ...retainedCodes.map((code) => ({
        value: code,
        label: formatLocaleLabel(code),
        disabled: usedByOtherRows.has(code),
      })),
    ];
  };

  const isSaveDisabled = draftEntries.some(
    (entry) => !entry.language || !entry.name,
  );

  /*
   * With no selectable language and no retained entry there is nothing the
   * popup could ever produce: every row would be missing its required
   * language, so Save would stay permanently disabled. Render no control at
   * all rather than an unusable one. A retained entry keeps the control so it
   * can still be edited or deleted. `value` is left untouched — `onChange`
   * never fires from here, so already-stored locales survive.
   */
  if (availableLocaleOptions.length === 0 && !hasRetainedEntry) return null;

  return (
    <div
      className={mergeClasses('flex items-center gap-2', className)}
      style={cssVars}
    >
      {value.length > 0 && (
        <span className={mergeClasses(styles.summary, summaryClassName)}>
          {`${summaryLabel}: ${value.map((entry) => `[${entry.language.toUpperCase()}]`).join(', ')}`}
        </span>
      )}
      <LinkButton
        label={value.length > 0 ? editLabel : addLabel}
        iconBefore={
          <IconPlus
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            stroke={DIAL_KIT_ICON_STROKE}
          />
        }
        className="px-0!"
        onClick={handleOpen}
      />

      <Popup
        open={isOpen}
        header={popupTitle}
        onClose={handleCancel}
        mainButtons={[
          { label: cancelLabel, onClick: handleCancel },
          {
            label: saveLabel,
            variant: ButtonVariant.Primary,
            disabled: isSaveDisabled,
            onClick: handleSave,
          },
        ]}
      >
        {/* The popup renders in a portal, outside the root that carries the vars. */}
        <div className="flex flex-col gap-8 px-6 py-3" style={cssVars}>
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
                  <span
                    className={mergeClasses(styles.rowLabel, rowLabelClassName)}
                  >
                    {localeRowLabel} {index + 1}
                  </span>
                  <DangerIconButton
                    appearance={ButtonAppearance.Ghost}
                    size={ElementSize.Small}
                    icon={
                      <IconTrashX
                        size={DIAL_ICON_SIZE.SM}
                        aria-hidden
                        stroke={DIAL_KIT_ICON_STROKE}
                      />
                    }
                    aria-label={`${deleteAriaLabel} ${index + 1}`}
                    onClick={() => handleRowDelete(entry.id)}
                  />
                </div>

                <div
                  role="group"
                  aria-label={`${localeRowLabel} ${index + 1}`}
                  className="flex flex-col gap-5"
                >
                  <div className="flex flex-col gap-5 desktop:flex-row desktop:items-start">
                    <Select
                      id={`${entry.id}-language`}
                      labelProps={{ label: languageLabel, required: true }}
                      /* Full width when stacked; on one row, wide enough for a full BCP-47 tag ("PT-BR") plus the chevron. */
                      className="desktop:shrink-0 desktop:basis-40"
                      options={buildLanguageOptions(entry, usedByOtherRows)}
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
                      labelProps={{ label: nameLabel, required: true }}
                      placeholder={namePlaceholder}
                    />
                  </div>

                  <Textarea
                    id={`${entry.id}-description`}
                    className={RESIZABLE_TEXTAREA_CLASS_NAME}
                    resize={TextareaResize.Vertical}
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
            iconBefore={
              <IconPlus
                size={DIAL_ICON_SIZE.SM}
                aria-hidden
                stroke={DIAL_KIT_ICON_STROKE}
              />
            }
            className="self-start"
            onClick={handleAddRow}
            disabled={usedConfiguredCount >= availableLocaleOptions.length}
          />
        </div>
      </Popup>
    </div>
  );
};

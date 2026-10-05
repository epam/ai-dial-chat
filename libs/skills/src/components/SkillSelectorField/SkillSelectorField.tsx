import {
  buildCssVars,
  DeploymentIcon,
  isSkillSelectionUnsupported,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  Highlight,
  Select,
  Tooltip,
} from '@epam/ai-dial-ui-kit';
import { useId, useLayoutEffect, useRef, useState, type FC } from 'react';
import { SKILLS_CLASS } from '../../constants/public-class-names';
import type {
  SkillSelectorFieldProps,
  SkillSelectorOption,
} from '../../models/skill-selector-field-props';
import styles from './SkillSelectorField.module.scss';

const EMPTY_SKILLS: SkillSelectorOption[] = [];
const DEFAULT_UNAVAILABLE_TOOLTIP_LABEL =
  'Selected model does not support skills. Select a different model to use a skill.';

/** Controlled multi-skill Select listing the given skills as checkbox options. */
export const SkillSelectorField: FC<SkillSelectorFieldProps> = ({
  value,
  onChange,
  displayNames,
  skills = EMPTY_SKILLS,
  isSkillsSupported,
  isDisabled = false,
  error,
  labels,
  className,
  styles: fieldStyles,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();
  const unsupported = value.some((url) =>
    isSkillSelectionUnsupported(url, isSkillsSupported),
  );
  const canAdd = isSkillsSupported && !isDisabled;
  const open = isOpen && canAdd;
  const unsupportedReason =
    value.length > 0
      ? labels.unsupportedTooltipLabel
      : (labels.unavailableTooltipLabel ?? DEFAULT_UNAVAILABLE_TOOLTIP_LABEL);
  const isUnavailableHintShown = !isSkillsSupported && value.length === 0;
  const description =
    error ?? (isUnavailableHintShown ? unsupportedReason : undefined);
  const optionItems = new Map(
    value.map((url) => [url, { id: url, name: displayNames?.[url] || url }]),
  );
  skills.forEach((skill) => optionItems.set(skill.id, skill));
  const options = [...optionItems.values()].map((item) => ({
    value: item.id,
    label: item.name,
    labelNode: query.trim() ? (
      <Highlight text={item.name} query={query} maxLines={1} />
    ) : undefined,
    icon: <DeploymentIcon size={DIAL_ICON_SIZE.SM} initialsName={item.name} />,
    disabled: !isSkillsSupported,
  }));
  const cssVars = {
    ...buildCssVars({
      '--ssf-text': fieldStyles?.colors?.text,
      '--ssf-bg': fieldStyles?.colors?.background,
      '--ssf-border': fieldStyles?.colors?.border,
      '--ssf-error': fieldStyles?.colors?.error,
    }),
    ...fieldStyles?.cssVars,
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !canAdd) return;
    setIsOpen(nextOpen);
  };

  /* Select does not expose the combobox ARIA state directly, so bridge the
   * host validation description onto its focus target until the kit does. */
  useLayoutEffect(() => {
    const combobox =
      rootRef.current?.querySelector<HTMLInputElement>('[role="combobox"]');
    if (!combobox) return;

    if (description) combobox.setAttribute('aria-describedby', descriptionId);
    else combobox.removeAttribute('aria-describedby');

    if (error || unsupported) combobox.setAttribute('aria-invalid', 'true');
    else combobox.removeAttribute('aria-invalid');
  }, [description, descriptionId, error, isDisabled, unsupported]);

  return (
    <div
      ref={rootRef}
      className={mergeClasses('min-w-0', className, SKILLS_CLASS.selectorField)}
      style={cssVars}
    >
      <Tooltip
        tooltip={unsupportedReason}
        hideTooltip={isSkillsSupported}
        triggerClassName="block w-full min-w-0"
      >
        <div inert={isDisabled ? true : undefined}>
          <Select
            multiple
            searchable
            open={open}
            onOpenChange={handleOpenChange}
            onSearchQueryChange={setQuery}
            value={value}
            onChange={(nextValue) => {
              if (!isDisabled)
                onChange(Array.isArray(nextValue) ? nextValue : [nextValue]);
            }}
            options={options}
            placeholder={labels.placeholder}
            labelProps={{ label: labels.fieldLabel }}
            error={error}
            caption={isUnavailableHintShown ? unsupportedReason : undefined}
            searchPlaceholder={labels.searchPlaceholder ?? 'Search skills'}
            emptyStateTitle={
              query.trim()
                ? (labels.noMatchingSkillsLabel ?? 'No matching skills')
                : (labels.emptyLabel ?? 'No skills available')
            }
            disabled={isDisabled || isUnavailableHintShown}
            invalid={Boolean(error) || unsupported}
            className="w-full min-w-0"
            fieldClassName={mergeClasses(
              canAdd ? 'cursor-pointer' : 'cursor-not-allowed',
              '--ssf-bg' in cssVars && styles.background,
              '--ssf-border' in cssVars && styles.border,
              '--ssf-text' in cssVars && styles.value,
              (error || unsupported) && styles.invalid,
              fieldStyles?.typography?.fontClassName ?? 'dial-small-text',
              fieldStyles?.triggerClassName,
            )}
            listClassName="w-[min(var(--reference-width),calc(100vw-2rem))] max-w-full"
          />
        </div>
      </Tooltip>
      {description && (
        <span id={descriptionId} className="sr-only">
          {description}
        </span>
      )}
    </div>
  );
};

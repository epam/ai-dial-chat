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
import { useId, useState, type FC } from 'react';
import { SKILLS_CLASS } from '../../constants/public-class-names';
import type {
  SkillSelectorFieldProps,
  SkillSelectorOption,
} from '../../models/skill-selector-field-props';
import styles from './SkillSelectorField.module.scss';

const EMPTY_SKILLS: SkillSelectorOption[] = [];

const DEFAULT_UNAVAILABLE_HINT_LABEL =
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
  const descriptionId = useId();
  const unsupported = value.some((url) =>
    isSkillSelectionUnsupported(url, isSkillsSupported),
  );
  const canAdd = isSkillsSupported && !isDisabled;
  const open = isOpen && canAdd;
  /* The unsupported reason exists only while a selection is present; with no
   * selection and no support the field is simply disabled, without a
   * tooltip or caption. */
  const unsupportedReason =
    value.length > 0 ? labels.unsupportedTooltipLabel : undefined;
  const isUnavailableHintShown = !isSkillsSupported && value.length === 0;
  /* The design shows no visible tooltip or caption for the disabled empty
   * field, so the reason reaches assistive tech through the screen-reader-only
   * description alone. A host validation error is passed to Select as the
   * error, never aliased into this description. */
  const description = isUnavailableHintShown
    ? (labels.unavailableHintLabel ?? DEFAULT_UNAVAILABLE_HINT_LABEL)
    : undefined;
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

  return (
    <div
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
            ariaDescribedBy={description ? descriptionId : undefined}
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

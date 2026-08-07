import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { TagInput } from '@epam/ai-dial-kit';
import {
  ButtonAppearance,
  ButtonVariant,
  Input,
  DialButton,
  DialSelect,
} from '@epam/ai-dial-ui-kit';
import {
  FC,
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PublicationRule, PublicationRuleFunction } from '../../models/publish';
import styles from './PublishAccessRuleEditor.module.scss';

const MAX_TARGETS_DEFAULT = 20;
const MAX_RULE_VALUE_LENGTH = 200;
/** `DialSelect`'s built-in search is enabled once the source list is long enough to be hard to scan. */
const SEARCHABLE_SOURCE_THRESHOLD = 8;

/** Text overrides for all user-visible strings in {@link PublishAccessRuleEditor}. */
export interface PublishAccessRuleEditorLabels {
  /** Label above the source picker. Default: `'Source'`. */
  sourceLabel?: string;
  /** Placeholder for the source picker. Default: `'Select...'`. */
  sourcePlaceholder?: string;
  /** Label above the function picker. Default: `'Function'`. */
  functionLabel?: string;
  /** Label for the `EQUAL` function option. Default: `'Equal'`. */
  equalOptionLabel?: string;
  /** Label for the `CONTAIN` function option. Default: `'Contain'`. */
  containOptionLabel?: string;
  /** Label for the `REGEX` function option. Default: `'Regex'`. */
  regexOptionLabel?: string;
  /** Label above the targets tag input (EQUAL/CONTAIN). Default: `'Targets'`. */
  targetsLabel?: string;
  /** Placeholder for the targets tag input. Default: `'Add a target'`. */
  targetsPlaceholder?: string;
  /** Label above the pattern field (REGEX). Default: `'Pattern'`. */
  patternLabel?: string;
  /** Placeholder for the pattern field. Default: `'Enter a regular expression'`. */
  patternPlaceholder?: string;
  /** Inline error shown for an invalid or empty regular expression. Default: `'Enter a valid regular expression.'`. */
  invalidRegexError?: string;
  /** Label for the action that saves the rule. Default: `'Save'`. */
  saveLabel?: string;
  /** Label for the action that discards the in-progress rule. Default: `'Cancel'`. */
  cancelLabel?: string;
  /** Accessible label for the editor's dialog role. Default: `'Add access rule'`. */
  dialogAriaLabel?: string;
}

/** Props for {@link PublishAccessRuleEditor}. */
export interface PublishAccessRuleEditorProps {
  /** Options offered in the source picker. */
  sourceOptions: string[];
  /** Called with the completed rule when the user saves it. */
  onSave: (rule: PublicationRule) => void;
  /** Called when the in-progress rule is discarded (Cancel or Escape). */
  onCancel: () => void;
  /** Disables every control in the editor. Default: `false`. */
  disabled?: boolean;
  /** Maximum number of targets allowed for an EQUAL/CONTAIN rule. Default: `20`. */
  maxTargets?: number;
  /** Text overrides for all user-visible strings. */
  labels?: PublishAccessRuleEditorLabels;
  /** Typography class for the source/function field labels. Default: `'dial-small-semi-text'`. */
  labelClassName?: string;
  /** Typography class for the pattern validation error. Default: `'dial-small-text'`. */
  errorClassName?: string;
  /** Color overrides. */
  colors?: PublishAccessRuleEditorColors;
}

/** Color overrides for {@link PublishAccessRuleEditor}, applied as CSS custom properties with app theme fallbacks. */
export interface PublishAccessRuleEditorColors {
  /** Background color of the full-screen mobile overlay. Fallback: `--bg-layer-1`. */
  mobileBackground?: string;
  /** Border color of the desktop inline panel. Fallback: `--stroke-tertiary`. */
  border?: string;
  /** Background color of the desktop inline panel. Fallback: `--bg-layer-sunken`. */
  background?: string;
  /** Text color of the source/function field labels. Fallback: `--text-primary`. */
  labelText?: string;
  /** Text color of the pattern validation error. Fallback: `--text-error`. */
  errorText?: string;
}

const isValidRegex = (pattern: string): boolean => {
  const trimmed = pattern.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RULE_VALUE_LENGTH) {
    return false;
  }
  try {
    return new RegExp(trimmed) instanceof RegExp;
  } catch {
    return false;
  }
};

/**
 * Single-rule editor for the access-rules section: source and function
 * pickers, plus a multi-target tag input for EQUAL/CONTAIN or a single
 * pattern field for REGEX. Renders inline on desktop and as a full-screen
 * step on mobile, using responsive Tailwind classes only.
 */
export const PublishAccessRuleEditor: FC<PublishAccessRuleEditorProps> = ({
  sourceOptions,
  onSave,
  onCancel,
  disabled = false,
  maxTargets = MAX_TARGETS_DEFAULT,
  labels = {},
  labelClassName = 'dial-small-semi-text',
  errorClassName = 'dial-small-text',
  colors,
}) => {
  const cssVars = buildCssVars({
    '--pare-mobile-bg': colors?.mobileBackground,
    '--pare-border': colors?.border,
    '--pare-bg': colors?.background,
    '--pare-label-text': colors?.labelText,
    '--pare-error-text': colors?.errorText,
  });

  const {
    sourceLabel = 'Source',
    sourcePlaceholder = 'Select...',
    functionLabel = 'Function',
    equalOptionLabel = 'Equal',
    containOptionLabel = 'Contain',
    regexOptionLabel = 'Regex',
    targetsLabel = 'Targets',
    targetsPlaceholder = 'Add a target',
    patternLabel = 'Pattern',
    patternPlaceholder = 'Enter a regular expression',
    invalidRegexError = 'Enter a valid regular expression.',
    saveLabel = 'Save',
    cancelLabel = 'Cancel',
    dialogAriaLabel = 'Add access rule',
  } = labels;

  const patternErrorId = useId();
  const sourceElementId = useId();
  const functionElementId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /*
     * Moves focus into the newly opened editor, matching the WAI-ARIA dialog
     * pattern; focus is restored to the trigger by the host on close.
     */
    dialogRef.current?.focus();
  }, []);

  const [source, setSource] = useState<string>();
  const [ruleFunction, setRuleFunction] = useState<PublicationRuleFunction>();
  const [targets, setTargets] = useState<string[]>([]);
  const [tagInputResetKey, setTagInputResetKey] = useState(0);
  const [pattern, setPattern] = useState('');

  const sourceSelectOptions = useMemo(
    () => sourceOptions.map((option) => ({ value: option, label: option })),
    [sourceOptions],
  );

  const functionOptions = useMemo(
    () => [
      { value: PublicationRuleFunction.Equal, label: equalOptionLabel },
      { value: PublicationRuleFunction.Contain, label: containOptionLabel },
      { value: PublicationRuleFunction.Regex, label: regexOptionLabel },
    ],
    [equalOptionLabel, containOptionLabel, regexOptionLabel],
  );

  const isRegex = ruleFunction === PublicationRuleFunction.Regex;
  const isPatternValid = isValidRegex(pattern);

  const isStructurallyComplete =
    source != null &&
    ruleFunction != null &&
    (isRegex ? isPatternValid : targets.length > 0);

  const handleFunctionChange = (next: string | string[]) => {
    const value = Array.isArray(next) ? next[0] : next;
    setRuleFunction(value as PublicationRuleFunction);
    setTargets([]);
    setPattern('');
    setTagInputResetKey((key) => key + 1);
  };

  /** Trims each tag and rejects an exact-duplicate (post-trim, case-sensitive) target, remounting the tag input to reflect the corrected list when a correction was made. */
  const handleTargetsChange = (nextTags: string[]) => {
    const deduped: string[] = [];
    for (const rawTag of nextTags) {
      const trimmed = rawTag.trim();
      if (trimmed.length === 0 || deduped.includes(trimmed)) {
        continue;
      }
      deduped.push(trimmed);
      if (deduped.length >= maxTargets) {
        break;
      }
    }
    setTargets(deduped);
    const wasCorrected =
      deduped.length !== nextTags.length ||
      deduped.some((tag, i) => tag !== nextTags[i]);
    if (wasCorrected) {
      setTagInputResetKey((key) => key + 1);
    }
  };

  const handleSave = () => {
    if (!isStructurallyComplete || source == null || ruleFunction == null) {
      return;
    }
    onSave({
      source,
      function: ruleFunction,
      targets: isRegex ? [pattern.trim()] : targets,
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      /*
       * Stops the keydown from reaching a host-level Escape listener (e.g.
       * the Publish panel's own close-on-Escape) so only this in-progress
       * rule is cancelled, not the whole panel.
       */
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={dialogAriaLabel}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={cssVars}
      className={mergeClasses(
        'fixed inset-0 z-[60] flex flex-col gap-3 overflow-y-auto p-4',
        'desktop:static desktop:z-auto desktop:flex-none desktop:overflow-visible desktop:rounded-lg desktop:border desktop:p-3',
        styles.dialog,
      )}
    >
      <div>
        <label
          htmlFor={sourceElementId}
          className={mergeClasses('mb-1 block', labelClassName, styles.label)}
        >
          {sourceLabel}
        </label>
        <DialSelect
          elementId={sourceElementId}
          options={sourceSelectOptions}
          value={source}
          onChange={(next) => setSource(Array.isArray(next) ? next[0] : next)}
          placeholder={sourcePlaceholder}
          searchable={sourceOptions.length > SEARCHABLE_SOURCE_THRESHOLD}
          searchPlaceholder={sourcePlaceholder}
          disabled={disabled}
        />
      </div>

      <div>
        <label
          htmlFor={functionElementId}
          className={mergeClasses('mb-1 block', labelClassName, styles.label)}
        >
          {functionLabel}
        </label>
        <DialSelect
          elementId={functionElementId}
          options={functionOptions}
          value={ruleFunction}
          onChange={handleFunctionChange}
          placeholder={functionLabel}
          disabled={disabled}
        />
      </div>

      {isRegex ? (
        <div>
          <Input
            id={`${patternErrorId}-input`}
            labelProps={{ label: patternLabel }}
            placeholder={patternPlaceholder}
            value={pattern}
            onChange={(value) => setPattern(value ?? '')}
            invalid={pattern.length > 0 && !isPatternValid}
            aria-describedby={
              pattern.length > 0 && !isPatternValid ? patternErrorId : undefined
            }
            disabled={disabled}
          />
          {pattern.length > 0 && !isPatternValid && (
            <span
              id={patternErrorId}
              role="alert"
              className={mergeClasses(
                'mt-1 block',
                errorClassName,
                styles.error,
              )}
            >
              {invalidRegexError}
            </span>
          )}
        </div>
      ) : (
        <TagInput
          key={tagInputResetKey}
          elementId="publish-access-rule-targets"
          label={targetsLabel}
          placeholder={targetsPlaceholder}
          initialTags={targets}
          onChange={handleTargetsChange}
          disabled={disabled}
        />
      )}

      <div className="mt-auto flex justify-end gap-2 desktop:mt-2">
        <DialButton
          appearance={ButtonAppearance.Ghost}
          variant={ButtonVariant.Secondary}
          label={cancelLabel}
          onClick={onCancel}
          disabled={disabled}
        />
        <DialButton
          appearance={ButtonAppearance.Solid}
          variant={ButtonVariant.Primary}
          label={saveLabel}
          onClick={handleSave}
          disabled={disabled || !isStructurallyComplete}
        />
      </div>
    </div>
  );
};

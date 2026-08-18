import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonVariant,
  DIAL_ICON_SIZE,
  GhostButton,
  GhostIconButton,
  Notification,
  NotificationType,
  NotificationVariant,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconPlus, IconTrashX } from '@tabler/icons-react';
import { FC, useEffect, useId, useRef, useState } from 'react';
import { PublicationRule, PublicationRuleFunction } from '../../models/publish';
import type { PublishAccessRuleEditorLabels } from '../../models/publish-access-rule-editor';
import type { PublishAccessRulesStyles } from '../../models/publish-access-rules-styles';
import { PublishAccessRuleEditor } from '../PublishAccessRuleEditor/PublishAccessRuleEditor';
import styles from './PublishAccessRules.module.scss';

const MAX_RULES_DEFAULT = 20;

/** Text overrides for all user-visible strings in {@link PublishAccessRules}. */
export interface PublishAccessRulesLabels {
  /** Section heading. Default: `'Allow access if all match'`. */
  heading?: string;
  /** Hint under the heading naming the destination folder the rules apply to; `{folder}` is replaced. Default: `'These rules apply to "{folder}". Selecting another folder loads that folder\'s own rules instead.'`. */
  folderScopeHint?: string;
  /** Hint under the heading shown while no destination folder is selected. Default: `'Access rules apply to the destination folder — pick a folder above to set its rules.'`. */
  noFolderScopeHint?: string;
  /** Warning shown when rules exist while no destination folder is selected. Default: `'These rules have no destination yet. Select a folder above to apply them.'`. */
  rulesWithoutFolderWarning?: string;
  /** Hint next to a disabled "Add rule" trigger once `maxRules` is reached; `{max}` is replaced. Default: `'Rule limit reached ({max}). Remove a rule to add another.'`. */
  maxRulesReachedLabel?: string;
  /** Label for the trigger that opens the single-rule editor. Default: `'Add rule'`. */
  addRuleLabel?: string;
  /** Label for the control that removes every rule; shown only when at least one rule exists. Default: `'Clear all'`. */
  clearAllLabel?: string;
  /** Separator joining a rule's targets. Default: `'Or'`. */
  orSeparatorLabel?: string;
  /** Accessible name template for a chip's remove control; `{source}` and `{targets}` are replaced. Default: `'Remove rule for {source}: {targets}'`. */
  removeRuleAriaLabelTemplate?: string;
  /** Chip label for an `EQUAL` rule. Default: `'Equal'`. */
  equalFunctionLabel?: string;
  /** Chip label for a `CONTAIN` rule. Default: `'Contain'`. */
  containFunctionLabel?: string;
  /** Chip label for a `REGEX` rule. Default: `'Regex'`. */
  regexFunctionLabel?: string;
  /** Shown while existing rules are being fetched for the selected folder. Default: `'Loading existing rules…'`. */
  loadingLabel?: string;
  /** Shown when fetching existing rules for the selected folder failed. Default: `"Couldn't load existing rules for this folder. You can still add rules manually."`. */
  loadErrorLabel?: string;
  /** Live-region announcement after a rule is added. Default: `'Rule added.'`. */
  ruleAddedAnnouncement?: string;
  /** Live-region announcement after a rule is removed. Default: `'Rule removed.'`. */
  ruleRemovedAnnouncement?: string;
  /** Live-region announcement after all rules are cleared. Default: `'All rules cleared.'`. */
  rulesClearedAnnouncement?: string;
  /** Live-region announcement after existing rules are loaded for a selected folder. Default: `'Existing rules loaded for the selected folder.'`. */
  rulesLoadedAnnouncement?: string;
  /** Text overrides passed through to the nested single-rule editor. */
  editorLabels?: PublishAccessRuleEditorLabels;
}

/** Props for {@link PublishAccessRules}. */
export interface PublishAccessRulesProps {
  /** Current access rules, combined with AND. */
  rules: PublicationRule[];
  /** Called with the full next rules array on add, remove, or clear. */
  onRulesChange: (rules: PublicationRule[]) => void;
  /** Options offered in the single-rule editor's source picker. */
  sourceOptions: string[];
  /** Name of the destination folder these rules apply to; `undefined` while no folder is selected. */
  folderName?: string;
  /** Disables every control in the section, e.g. while a publish request is in flight. Default: `false`. */
  disabled?: boolean;
  /** Whether existing rules are currently being fetched for the selected folder. Default: `false`. */
  isLoading?: boolean;
  /** Whether the most recent existing-rules fetch failed. Default: `false`. */
  hasLoadError?: boolean;
  /** Maximum number of rules allowed. Default: `20`. */
  maxRules?: number;
  /** Maximum number of targets allowed per EQUAL/CONTAIN rule. Default: `20`. */
  maxTargetsPerRule?: number;
  /** Text overrides for all user-visible strings. */
  labels?: PublishAccessRulesLabels;
  /** Typography class for the section heading. Default: `'dial-body-semi-text'`. */
  headingClassName?: string;
  /** Typography class for the folder-scope and rule-limit hints. Default: `'dial-small-text'`. */
  hintClassName?: string;
  /** Typography class for the loading message. Default: `'dial-small-text'`. */
  loadingClassName?: string;
  /** Typography class for each rule chip's text. Default: `'dial-small-text'`. */
  ruleTextClassName?: string;
  /** Typography class for the emphasised rule source inside each chip. Default: `'dial-small-semi-text'`. */
  ruleSourceClassName?: string;
  /** Style overrides. */
  styles?: PublishAccessRulesStyles;
}

const functionLabel = (
  fn: PublicationRuleFunction,
  labels: { equal: string; contain: string; regex: string },
): string => {
  if (fn === PublicationRuleFunction.Equal) return labels.equal;
  if (fn === PublicationRuleFunction.Contain) return labels.contain;
  return labels.regex;
};

/** Renders access rules with controls to add, remove, and clear them. */
export const PublishAccessRules: FC<PublishAccessRulesProps> = ({
  rules,
  onRulesChange,
  sourceOptions,
  folderName,
  disabled = false,
  isLoading = false,
  hasLoadError = false,
  maxRules = MAX_RULES_DEFAULT,
  maxTargetsPerRule,
  labels = {},
  headingClassName = 'dial-body-semi-text',
  hintClassName = 'dial-small-text',
  loadingClassName = 'dial-small-text',
  ruleTextClassName = 'dial-small-text',
  ruleSourceClassName = 'dial-small-semi-text',
  styles: stylesProp = {},
}) => {
  const cssVars = {
    ...buildCssVars({
      '--par-rule-bg': stylesProp.colors?.ruleBackground,
      '--par-heading-text': stylesProp.colors?.headingText,
      '--par-hint-text': stylesProp.colors?.hintText,
      '--par-loading-text': stylesProp.colors?.loadingText,
      '--par-rule-text': stylesProp.colors?.ruleText,
    }),
    ...stylesProp.cssVars,
  };

  const {
    heading = 'Allow access if all match',
    folderScopeHint = 'These rules apply to "{folder}". Selecting another folder loads that folder\'s own rules instead.',
    noFolderScopeHint = 'Access rules apply to the destination folder — pick a folder above to set its rules.',
    rulesWithoutFolderWarning = 'These rules have no destination yet. Select a folder above to apply them.',
    maxRulesReachedLabel = 'Rule limit reached ({max}). Remove a rule to add another.',
    addRuleLabel = 'Add rule',
    clearAllLabel = 'Clear all',
    orSeparatorLabel = 'Or',
    removeRuleAriaLabelTemplate = 'Remove rule for {source}: {targets}',
    equalFunctionLabel = 'Equal',
    containFunctionLabel = 'Contain',
    regexFunctionLabel = 'Regex',
    loadingLabel = 'Loading existing rules…',
    loadErrorLabel:
      loadErrorLabelText = "Couldn't load existing rules for this folder. You can still add rules manually.",
    ruleAddedAnnouncement = 'Rule added.',
    ruleRemovedAnnouncement = 'Rule removed.',
    rulesClearedAnnouncement = 'All rules cleared.',
    rulesLoadedAnnouncement = 'Existing rules loaded for the selected folder.',
    editorLabels,
  } = labels;

  const headingId = useId();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  /*
   * Captures whatever had focus (typically the "Add rule" trigger) before the
   * editor opened, so focus can be restored to it once the editor closes —
   * works regardless of the underlying ui-kit button's ref-forwarding.
   */
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const wasLoadingRef = useRef(isLoading);
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading && rules.length > 0) {
      setStatusMessage(rulesLoadedAnnouncement);
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, rules, rulesLoadedAnnouncement]);

  const handleOpenEditor = () => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    previousFocusRef.current?.focus?.();
  };

  const handleAddRule = (rule: PublicationRule) => {
    onRulesChange([...rules, rule]);
    setStatusMessage(ruleAddedAnnouncement);
    handleCloseEditor();
  };

  const handleRemoveRule = (index: number) => {
    onRulesChange(rules.filter((_, i) => i !== index));
    setStatusMessage(ruleRemovedAnnouncement);
  };

  const handleClearAll = () => {
    onRulesChange([]);
    setStatusMessage(rulesClearedAnnouncement);
  };

  const functionLabels = {
    equal: equalFunctionLabel,
    contain: containFunctionLabel,
    regex: regexFunctionLabel,
  };

  const isMaxRulesReached = rules.length >= maxRules;
  const isAddDisabled = disabled || isMaxRulesReached;
  const hasFolder = folderName != null && folderName !== '';

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      style={cssVars}
      className={mergeClasses(disabled && 'pointer-events-none opacity-60')}
    >
      <span role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </span>

      <div className="mb-1 flex items-center justify-between gap-2">
        <div
          id={headingId}
          className={mergeClasses(headingClassName, styles.heading)}
        >
          {heading}
        </div>
        {rules.length > 0 && (
          <GhostButton
            variant={ButtonVariant.Primary}
            label={clearAllLabel}
            onClick={handleClearAll}
            disabled={disabled}
          />
        )}
      </div>

      <p className={mergeClasses('mb-2', hintClassName, styles.hint)}>
        {hasFolder
          ? folderScopeHint.replace('{folder}', folderName)
          : noFolderScopeHint}
      </p>

      {rules.length > 0 && !hasFolder && (
        <div className="mb-2">
          <Notification
            type={NotificationType.SectionMessage}
            variant={NotificationVariant.Warning}
            message={rulesWithoutFolderWarning}
          />
        </div>
      )}

      {isLoading && (
        <div
          className={mergeClasses(
            'mb-2 flex items-center gap-2',
            loadingClassName,
            styles.loading,
          )}
        >
          <Spinner size={16} ariaLabel={loadingLabel} />
          <span>{loadingLabel}</span>
        </div>
      )}

      {hasLoadError && (
        <div className="mb-2">
          <Notification
            type={NotificationType.SectionMessage}
            variant={NotificationVariant.Warning}
            message={loadErrorLabelText}
          />
        </div>
      )}

      {rules.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {rules.map((rule, index) => {
            const targetsText = rule.targets.join(` ${orSeparatorLabel} `);
            const removeAriaLabel = removeRuleAriaLabelTemplate
              .replace('{source}', rule.source)
              .replace('{targets}', targetsText);
            return (
              <li
                key={index}
                className={mergeClasses(
                  'flex items-center justify-between gap-2 rounded-lg px-3 py-2',
                  styles.ruleRow,
                )}
              >
                <span
                  className={mergeClasses(
                    'truncate',
                    ruleTextClassName,
                    styles.ruleText,
                  )}
                >
                  <span className={ruleSourceClassName}>{rule.source}</span>{' '}
                  {functionLabel(rule.function, functionLabels)}: {targetsText}
                </span>
                <GhostIconButton
                  icon={<IconTrashX size={DIAL_ICON_SIZE.SM} aria-hidden />}
                  aria-label={removeAriaLabel}
                  onClick={() => handleRemoveRule(index)}
                  disabled={disabled}
                />
              </li>
            );
          })}
        </ul>
      )}

      {isEditorOpen && (
        <PublishAccessRuleEditor
          sourceOptions={sourceOptions}
          onSave={handleAddRule}
          onCancel={handleCloseEditor}
          disabled={disabled}
          maxTargets={maxTargetsPerRule}
          labels={editorLabels}
          styles={stylesProp.editor}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/*
         * Plain `GhostButton` stands in for a tertiary button: the installed
         * kit declares `ButtonVariant.Tertiary` but ships no CSS for it yet on
         * the real Button/GhostButton, so it would silently render as
         * primary-solid. Switch to `variant={ButtonVariant.Tertiary}` once the
         * kit adds the style.
         */}
        <GhostButton
          label={addRuleLabel}
          iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} aria-hidden />}
          onClick={handleOpenEditor}
          disabled={isAddDisabled}
        />
      </div>

      {isMaxRulesReached && (
        <p className={mergeClasses('mt-2', hintClassName, styles.hint)}>
          {maxRulesReachedLabel.replace('{max}', String(maxRules))}
        </p>
      )}
    </div>
  );
};

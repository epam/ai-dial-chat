import {
  PublishAccessRulesLabels,
  PublishPanelLabels,
} from '@epam/ai-dial-publish-panel';
import type { TFunction } from 'i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  PublishAccessRulesI18nKeys,
  PublishI18nKeys,
} from '../constants/translation-keys';

/**
 * Display name of a publish target folder, for notification copy.
 *
 * The Organization root is the whole public bucket and so has no path segments;
 * taking the last segment of its path yields an empty string, which rendered as
 * `folder ""` in the confirmation. It falls back to the same root label the
 * publish panel's folder tree shows for that node.
 *
 * Accepts either the `string[]` segments the publish panel hands its callbacks
 * or the already-joined path kept in publish history.
 */
export const getPublishFolderLabel = (
  folderPath: string | string[],
  t: TFunction,
): string => {
  const segments = Array.isArray(folderPath)
    ? folderPath
    : folderPath.split('/');
  return segments[segments.length - 1] || t(BasicI18nKeys.Organization);
};

/** Builds the translated `accessRulesLabels` overrides shared by every publish panel host (catalog, conversation). */
export const getAccessRulesLabels = (
  t: TFunction,
): PublishAccessRulesLabels => ({
  heading: t(PublishAccessRulesI18nKeys.Heading),
  folderScopeHint: t(PublishAccessRulesI18nKeys.FolderScopeHint),
  noFolderScopeHint: t(PublishAccessRulesI18nKeys.NoFolderScopeHint),
  rulesWithoutFolderWarning: t(
    PublishAccessRulesI18nKeys.RulesWithoutFolderWarning,
  ),
  maxRulesReachedLabel: t(PublishAccessRulesI18nKeys.MaxRulesReachedLabel),
  addRuleLabel: t(PublishAccessRulesI18nKeys.AddRuleLabel),
  clearAllLabel: t(PublishAccessRulesI18nKeys.ClearAllLabel),
  orSeparatorLabel: t(PublishAccessRulesI18nKeys.OrSeparatorLabel),
  removeRuleAriaLabelTemplate: t(
    PublishAccessRulesI18nKeys.RemoveRuleAriaLabelTemplate,
  ),
  equalFunctionLabel: t(PublishAccessRulesI18nKeys.EqualFunctionLabel),
  containFunctionLabel: t(PublishAccessRulesI18nKeys.ContainFunctionLabel),
  regexFunctionLabel: t(PublishAccessRulesI18nKeys.RegexFunctionLabel),
  loadingLabel: t(PublishAccessRulesI18nKeys.LoadingLabel),
  loadErrorLabel: t(PublishAccessRulesI18nKeys.LoadErrorLabel),
  ruleAddedAnnouncement: t(PublishAccessRulesI18nKeys.RuleAddedAnnouncement),
  ruleRemovedAnnouncement: t(
    PublishAccessRulesI18nKeys.RuleRemovedAnnouncement,
  ),
  rulesClearedAnnouncement: t(
    PublishAccessRulesI18nKeys.RulesClearedAnnouncement,
  ),
  rulesLoadedAnnouncement: t(
    PublishAccessRulesI18nKeys.RulesLoadedAnnouncement,
  ),
  editorLabels: {
    sourceLabel: t(PublishAccessRulesI18nKeys.SourceLabel),
    sourcePlaceholder: t(PublishAccessRulesI18nKeys.SourcePlaceholder),
    functionLabel: t(PublishAccessRulesI18nKeys.FunctionLabel),
    equalOptionLabel: t(PublishAccessRulesI18nKeys.EqualFunctionLabel),
    containOptionLabel: t(PublishAccessRulesI18nKeys.ContainFunctionLabel),
    regexOptionLabel: t(PublishAccessRulesI18nKeys.RegexFunctionLabel),
    targetsLabel: t(PublishAccessRulesI18nKeys.TargetsLabel),
    targetsPlaceholder: t(PublishAccessRulesI18nKeys.TargetsPlaceholder),
    targetsHintLabel: t(PublishAccessRulesI18nKeys.TargetsHintLabel),
    requiredFieldError: t(PublishAccessRulesI18nKeys.RequiredFieldError),
    targetsRequiredError: t(PublishAccessRulesI18nKeys.TargetsRequiredError),
    patternLabel: t(PublishAccessRulesI18nKeys.PatternLabel),
    patternPlaceholder: t(PublishAccessRulesI18nKeys.PatternPlaceholder),
    invalidRegexError: t(PublishAccessRulesI18nKeys.InvalidRegexError),
    saveLabel: t(ButtonsI18nKeys.Save),
    cancelLabel: t(ButtonsI18nKeys.Cancel),
    dialogAriaLabel: t(PublishAccessRulesI18nKeys.DialogAriaLabel),
  },
});

/** Builds the translated author-field label overrides shared by every publish panel host (catalog, conversation). */
export const getPublishAuthorLabels = (
  t: TFunction,
): Pick<
  PublishPanelLabels,
  'authorLabel' | 'authorPlaceholder' | 'authorHint'
> => ({
  authorLabel: t(PublishI18nKeys.AuthorLabel),
  authorPlaceholder: t(PublishI18nKeys.AuthorPlaceholder),
  authorHint: t(PublishI18nKeys.AuthorHint),
});

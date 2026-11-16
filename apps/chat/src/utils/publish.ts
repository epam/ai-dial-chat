import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import {
  PublishAccessRulesLabels,
  PublishDependenciesLabels,
  PublishDependencyType,
  PublishFooterLabels,
  PublishPanelLabels,
} from '@epam/ai-dial-publish-panel';
import type { TFunction } from 'i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  PublishAccessRulesI18nKeys,
  PublishI18nKeys,
  ResourceSavePanelI18nKeys,
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

/** Builds the translated folder, search, access-error and version labels shared by every publish panel host. */
export const getPublishPanelCommonLabels = (
  t: TFunction,
): Pick<
  PublishPanelLabels,
  | 'folderLabel'
  | 'destinationAriaLabel'
  | 'noFolderSelectedLabel'
  | 'changeFolderLabel'
  | 'chooseFolderLabel'
  | 'clearSearchAriaLabel'
  | 'noAccessError'
  | 'addSiblingFolderLabel'
  | 'addChildFolderLabel'
> => ({
  folderLabel: t(PublishI18nKeys.FolderLabel),
  destinationAriaLabel: t(ResourceSavePanelI18nKeys.DestinationAriaLabel),
  noFolderSelectedLabel: t(PublishI18nKeys.NoFolderSelected),
  changeFolderLabel: t(ResourceSavePanelI18nKeys.ChangeFolder),
  chooseFolderLabel: t(PublishI18nKeys.ChooseFolder),
  clearSearchAriaLabel: t(BasicI18nKeys.ClearSearch),
  noAccessError: t(PublishI18nKeys.NoAccessError),
  addSiblingFolderLabel: t(PublishI18nKeys.AddSiblingFolder),
  addChildFolderLabel: t(PublishI18nKeys.AddChildFolder),
});

/** Keys of the lowercase nouns that can name what is being published in the dependencies warning. */
export type PublishDependenciesEntityKey =
  | PublishI18nKeys.DependenciesEntityApplication
  | PublishI18nKeys.DependenciesEntityConversation
  | PublishI18nKeys.DependenciesEntityProject
  | PublishI18nKeys.DependenciesEntityToolset
  | PublishI18nKeys.DependenciesEntityPrompt
  | PublishI18nKeys.DependenciesEntitySkill
  | PublishI18nKeys.DependenciesEntityItem;

/**
 * Picks the noun that names a catalog item of the given type in the dependencies warning.
 * Types without a dedicated noun (models) fall back to the generic "item".
 * @param type - entity type of the catalog item being published
 */
export const getPublishDependenciesEntityKey = (
  type: CatalogEntityType,
): PublishDependenciesEntityKey => {
  switch (type) {
    case CatalogEntityType.Agent:
      return PublishI18nKeys.DependenciesEntityApplication;
    case CatalogEntityType.Toolset:
      return PublishI18nKeys.DependenciesEntityToolset;
    case CatalogEntityType.Prompt:
      return PublishI18nKeys.DependenciesEntityPrompt;
    case CatalogEntityType.Skill:
      return PublishI18nKeys.DependenciesEntitySkill;
    default:
      return PublishI18nKeys.DependenciesEntityItem;
  }
};

/**
 * Builds the translated admin-approval callout labels, naming what is being published.
 * @param t - translation function
 * @param entityKey - key of the lowercase noun naming what is being published, spliced into the message
 */
export const getPublishApprovalLabels = (
  t: TFunction,
  entityKey: PublishDependenciesEntityKey,
): Pick<PublishPanelLabels, 'adminApprovalTitle' | 'adminApprovalMessage'> => ({
  adminApprovalTitle: t(PublishI18nKeys.AdminApprovalTitle),
  adminApprovalMessage: t(PublishI18nKeys.AdminApprovalMessage, {
    entity: t(entityKey),
  }),
});

/**
 * Builds the translated labels of the private-dependencies section, shared by every publish panel host.
 * @param t - translation function
 * @param entityKey - key of the lowercase noun naming what is being published, spliced into the warning
 */
export const getPublishDependenciesLabels = (
  t: TFunction,
  entityKey: PublishDependenciesEntityKey,
): PublishDependenciesLabels => ({
  title: t(PublishI18nKeys.DependenciesTitle),
  description: t(PublishI18nKeys.DependenciesDescription, {
    entity: t(entityKey),
  }),
  typeLabels: {
    [PublishDependencyType.Application]: t(
      PublishI18nKeys.DependenciesTypeApplication,
    ),
    [PublishDependencyType.Toolset]: t(PublishI18nKeys.DependenciesTypeToolset),
    [PublishDependencyType.Prompt]: t(PublishI18nKeys.DependenciesTypePrompt),
    [PublishDependencyType.Skill]: t(PublishI18nKeys.DependenciesTypeSkill),
    [PublishDependencyType.File]: t(PublishI18nKeys.DependenciesTypeFile),
  },
  getAnnouncement: (count) =>
    t(PublishI18nKeys.DependenciesAnnouncement, { count }),
});

/** Builds the translated Update and in-progress footer labels shared by the conversation and project publish panels. */
export const getPublishFooterProgressLabels = (
  t: TFunction,
): Pick<
  PublishFooterLabels,
  'updateLabel' | 'publishingInProgressLabel' | 'selectFolderLabel'
> => ({
  updateLabel: t(PublishI18nKeys.UpdateVersion),
  selectFolderLabel: t(ButtonsI18nKeys.Select),
  publishingInProgressLabel: t(PublishI18nKeys.PublishingInProgress),
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
